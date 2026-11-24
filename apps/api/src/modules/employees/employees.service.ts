import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { paginate, Paginated } from '../../common/dto/pagination.dto';
import { EmployeeStatus } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { usernameCandidates, withNumericSuffix, workEmailFor } from '../../common/utils/identity.util';
import { AppConfig } from '../../config/configuration';
import { AuditService, csvCell } from '../audit/audit.service';
import { WorkflowRun } from '../workflows/workflow-run.entity';
import { fullName, WorkflowsService } from '../workflows/workflows.service';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './employee.entity';

/** Identifiants réservés : jamais attribués à un nouvel employé. */
const RESERVED_USERNAMES = new Set(['admin', 'root', 'system', 'support', 'security', 'n8n', 'gitea', 'mattermost']);

export interface Identity {
  username: string;
  workEmail: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async list(query: EmployeeQueryDto): Promise<Paginated<Employee>> {
    const qb = this.dataSource
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.accessProfile', 'profile');

    if (query.search) {
      const search = `%${query.search.replace(/[%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('employee.firstName ILIKE :search', { search })
            .orWhere('employee.lastName ILIKE :search', { search })
            .orWhere('employee.username ILIKE :search', { search })
            .orWhere('employee.workEmail ILIKE :search', { search })
            .orWhere('employee.employeeNumber ILIKE :search', { search })
            .orWhere("(employee.firstName || ' ' || employee.lastName) ILIKE :search", { search });
        }),
      );
    }
    if (query.status?.length) qb.andWhere('employee.status IN (:...status)', { status: query.status });
    if (query.department) qb.andWhere('employee.department = :department', { department: query.department });
    if (query.accessProfileId) {
      qb.andWhere('employee.accessProfileId = :profileId', { profileId: query.accessProfileId });
    }
    qb.orderBy(`employee.${query.sort}`, query.order)
      .addOrderBy('employee.lastName', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query.page, query.pageSize);
  }

  async getOrFail(id: string, em?: EntityManager): Promise<Employee> {
    const employee = await (em ?? this.dataSource.manager).getRepository(Employee).findOne({
      where: { id },
      relations: { accessProfile: true },
    });
    if (!employee) throw new NotFoundException('Employé introuvable');
    return employee;
  }

  /** Fiche complète : identité, accès effectifs et historique des exécutions. */
  async detail(id: string) {
    const employee = await this.getOrFail(id);
    const runs = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.employee', 'employee')
      .leftJoinAndSelect('run.steps', 'step')
      .where('run.employeeId = :id', { id })
      .orderBy('run.createdAt', 'DESC')
      .addOrderBy('step.position', 'ASC')
      .take(20)
      .getMany();
    const profile = employee.accessProfile;
    const accountsActive = employee.status !== EmployeeStatus.DEPARTED;
    return {
      ...employee,
      effectiveAccess: {
        realmRoles: Array.from(new Set([...profile.realmRoles, ...employee.extraRealmRoles])),
        extraRealmRoles: employee.extraRealmRoles,
        groups: profile.groups,
        giteaTeams: profile.giteaTeams,
        chatChannels: profile.chatChannels,
        accounts: {
          keycloak: employee.keycloakUserId ? { id: employee.keycloakUserId, active: accountsActive } : null,
          gitea: employee.giteaUsername ? { id: employee.giteaUsername, active: accountsActive } : null,
          chat: employee.chatUserId ? { id: employee.chatUserId, active: accountsActive } : null,
        },
      },
      runs: runs.map((run) => ({ ...this.workflows.toSummary(run), steps: run.steps })),
    };
  }

  /** Export CSV de l'annuaire filtré (séparateur « ; », BOM UTF-8 pour Excel). */
  async exportCsv(query: EmployeeQueryDto): Promise<string> {
    const rows: Employee[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const result = await this.list({ ...query, page, pageSize: 100 });
      rows.push(...result.items);
      if (page >= result.totalPages) break;
    }
    const header = ['matricule', 'prenom', 'nom', 'identifiant', 'email_pro', 'poste', 'service', 'profil', 'contrat', 'arrivee', 'fin_contrat', 'statut', 'manager'];
    const lines = rows.map((e) =>
      [
        e.employeeNumber,
        e.firstName,
        e.lastName,
        e.username,
        e.workEmail,
        e.jobTitle,
        e.department,
        e.accessProfile.name,
        e.contractType,
        e.startDate,
        e.endDate ?? '',
        e.status,
        e.managerName ?? '',
      ]
        .map((value) => csvCell(String(value)))
        .join(';'),
    );
    const BOM = String.fromCharCode(0xfeff);
    return `${BOM}${header.join(';')}\n${lines.join('\n')}\n`;
  }

  async departments(): Promise<string[]> {
    const rows: { department: string }[] = await this.dataSource
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .select('DISTINCT employee.department', 'department')
      .orderBy('department', 'ASC')
      .getRawMany();
    return rows.map((row) => row.department);
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: ActorContext): Promise<Employee> {
    return this.dataSource.transaction(async (em) => {
      const employee = await this.getOrFail(id, em);
      if (employee.status === EmployeeStatus.DEPARTED) {
        throw new ConflictException('La fiche d’un employé parti est en lecture seule');
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(dto) as [keyof UpdateEmployeeDto, unknown][]) {
        if (value !== undefined && employee[key] !== value) {
          changes[key] = { from: employee[key], to: value };
          (employee as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length === 0) return employee;
      const saved = await em.getRepository(Employee).save(employee);
      await this.audit.record(
        actor,
        {
          action: 'employee.updated',
          summary: `Fiche de ${fullName(saved)} modifiée (${Object.keys(changes).join(', ')})`,
          targetType: 'employee',
          targetId: saved.id,
          targetLabel: fullName(saved),
          metadata: { changes },
        },
        em,
      );
      return saved;
    });
  }

  /** Calcule un identifiant libre (prenom.nom, puis variantes, puis suffixe numérique). */
  async allocateIdentity(firstName: string, lastName: string, em?: EntityManager): Promise<Identity> {
    const repo = (em ?? this.dataSource.manager).getRepository(Employee);
    const candidates = usernameCandidates(firstName, lastName);
    const taken = new Set(
      (
        await repo
          .createQueryBuilder('employee')
          .select('employee.username', 'username')
          .where('employee.username LIKE ANY(:patterns)', {
            patterns: candidates.map((c) => `${c.slice(0, 18).replace(/[%_]/g, '\\$&')}%`),
          })
          .getRawMany<{ username: string }>()
      ).map((row) => row.username),
    );
    const isFree = (username: string) => !taken.has(username) && !RESERVED_USERNAMES.has(username);
    const domain = this.config.get('company', { infer: true }).emailDomain;

    for (const candidate of candidates) {
      if (isFree(candidate)) return { username: candidate, workEmail: workEmailFor(candidate, domain) };
    }
    for (let index = 2; index < 1000; index += 1) {
      const candidate = withNumericSuffix(candidates[0], index);
      if (isFree(candidate)) return { username: candidate, workEmail: workEmailFor(candidate, domain) };
    }
    throw new ConflictException('Impossible de générer un identifiant unique');
  }

  async nextEmployeeNumber(em: EntityManager): Promise<string> {
    const [{ value }] = (await em.query(`SELECT nextval('employee_number_seq') AS value`)) as { value: string }[];
    return `TP-${new Date().getFullYear()}-${String(value).padStart(4, '0')}`;
  }
}
