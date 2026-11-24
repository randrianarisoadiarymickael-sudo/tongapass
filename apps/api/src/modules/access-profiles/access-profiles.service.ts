import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmployeeStatus } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { ACCESS_CATALOG, BASELINE_ROLE } from './access-catalog';
import { AccessProfile } from './access-profile.entity';
import { CreateAccessProfileDto, UpdateAccessProfileDto } from './dto/access-profile.dto';

export interface AccessProfileView extends AccessProfile {
  employeeCount: number;
}

const ARRAY_FIELDS = ['realmRoles', 'groups', 'giteaTeams', 'chatChannels'] as const;

@Injectable()
export class AccessProfilesService {
  constructor(
    @InjectRepository(AccessProfile) private readonly profiles: Repository<AccessProfile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  catalog() {
    return ACCESS_CATALOG;
  }

  async list(includeInactive = false): Promise<AccessProfileView[]> {
    const profiles = await this.profiles.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
    const counts: { profileId: string; count: string }[] = await this.dataSource
      .getRepository(Employee)
      .createQueryBuilder('e')
      .select('e.accessProfileId', 'profileId')
      .addSelect('COUNT(*)', 'count')
      .where('e.status != :departed', { departed: EmployeeStatus.DEPARTED })
      .groupBy('e.accessProfileId')
      .getRawMany();
    const byId = new Map(counts.map((row) => [row.profileId, Number(row.count)]));
    return profiles.map((profile) => ({ ...profile, employeeCount: byId.get(profile.id) ?? 0 }));
  }

  async get(id: string): Promise<AccessProfile> {
    const profile = await this.profiles.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Profil d’accès introuvable');
    return profile;
  }

  async getActive(id: string): Promise<AccessProfile> {
    const profile = await this.get(id);
    if (!profile.isActive) throw new BadRequestException('Ce profil d’accès est désactivé');
    return profile;
  }

  async create(dto: CreateAccessProfileDto, actor: ActorContext): Promise<AccessProfile> {
    this.assertBaseline(dto.realmRoles);
    if (await this.profiles.exists({ where: { code: dto.code } })) {
      throw new ConflictException(`Le code « ${dto.code} » est déjà utilisé`);
    }
    return this.dataSource.transaction(async (em) => {
      const profile = await em.getRepository(AccessProfile).save(
        em.getRepository(AccessProfile).create({
          ...dto,
          description: dto.description ?? '',
          color: dto.color ?? '#3B57C2',
        }),
      );
      await this.audit.record(
        actor,
        {
          action: 'profile.created',
          summary: `Profil d’accès « ${profile.name} » créé`,
          targetType: 'access_profile',
          targetId: profile.id,
          targetLabel: profile.name,
          metadata: { realmRoles: profile.realmRoles, giteaTeams: profile.giteaTeams },
        },
        em,
      );
      return profile;
    });
  }

  async update(id: string, dto: UpdateAccessProfileDto, actor: ActorContext): Promise<AccessProfile> {
    const profile = await this.get(id);
    if (dto.realmRoles) this.assertBaseline(dto.realmRoles);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, value] of Object.entries(dto) as [keyof UpdateAccessProfileDto, unknown][]) {
      if (value === undefined) continue;
      const before = profile[key as keyof AccessProfile];
      const isArray = (ARRAY_FIELDS as readonly string[]).includes(key);
      const same = isArray
        ? JSON.stringify([...(before as string[])].sort()) === JSON.stringify([...(value as string[])].sort())
        : before === value;
      if (!same) changes[key] = { from: before, to: value };
    }
    if (Object.keys(changes).length === 0) return profile;

    return this.dataSource.transaction(async (em) => {
      Object.assign(profile, dto);
      const saved = await em.getRepository(AccessProfile).save(profile);
      await this.audit.record(
        actor,
        {
          action: 'profile.updated',
          summary: `Profil d’accès « ${saved.name} » modifié (${Object.keys(changes).join(', ')})`,
          targetType: 'access_profile',
          targetId: saved.id,
          targetLabel: saved.name,
          metadata: { changes },
        },
        em,
      );
      return saved;
    });
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const profile = await this.get(id);
    const used = await this.dataSource.getRepository(Employee).count({ where: { accessProfileId: id } });
    if (used > 0) {
      throw new ConflictException(
        `Profil utilisé par ${used} employé(s) : désactivez-le plutôt que de le supprimer`,
      );
    }
    await this.dataSource.transaction(async (em) => {
      await em.getRepository(AccessProfile).delete(id);
      await this.audit.record(
        actor,
        {
          action: 'profile.deleted',
          summary: `Profil d’accès « ${profile.name} » supprimé`,
          targetType: 'access_profile',
          targetId: id,
          targetLabel: profile.name,
        },
        em,
      );
    });
  }

  private assertBaseline(roles: string[]): void {
    if (!roles.includes(BASELINE_ROLE)) {
      throw new BadRequestException(`Le rôle socle « ${BASELINE_ROLE} » est obligatoire dans un profil`);
    }
  }
}
