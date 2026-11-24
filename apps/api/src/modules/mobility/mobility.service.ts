import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeeStatus, RunStatus, RunType } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { ACCESS_CATALOG } from '../access-profiles/access-catalog';
import { diffAccess, effectiveAccess } from '../access-profiles/access-diff';
import { AccessProfilesService } from '../access-profiles/access-profiles.service';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { fullName, WorkflowsService } from '../workflows/workflows.service';
import { CreateMobilityDto, MobilityPreviewDto } from './dto/mobility.dto';

const IMMEDIATE_MARGIN_MS = 60_000;
const MAX_SCHEDULE_MS = 180 * 86_400_000;
const MOBILE_STATUSES = [EmployeeStatus.ACTIVE, EmployeeStatus.OFFBOARDING_SCHEDULED];

/** Mobilité interne : ajuste les droits d'un employé à son nouveau poste (« mover » du cycle JML). */
@Injectable()
export class MobilityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profiles: AccessProfilesService,
    private readonly workflows: WorkflowsService,
    private readonly audit: AuditService,
  ) {}

  private async loadEmployee(id: string): Promise<Employee> {
    const employee = await this.dataSource
      .getRepository(Employee)
      .findOne({ where: { id }, relations: { accessProfile: true } });
    if (!employee) throw new NotFoundException('Employé introuvable');
    return employee;
  }

  /** Ce qui va changer : droits ajoutés, retirés et conservés, avec les droits sensibles ajoutés. */
  async preview(employeeId: string, dto: MobilityPreviewDto) {
    const employee = await this.loadEmployee(employeeId);
    const target = await this.profiles.getActive(dto.accessProfileId);
    const extra = (dto.extraRealmRoles ?? []).filter((role) => !target.realmRoles.includes(role));
    const current = effectiveAccess(employee.accessProfile, employee.extraRealmRoles);
    const next = effectiveAccess(target, extra);
    const diff = diffAccess(current, next);
    const sensitive = new Set(
      Object.values(ACCESS_CATALOG)
        .flat()
        .filter((item) => 'sensitive' in item && item.sensitive)
        .map((item) => item.value),
    );
    const addedValues = [...diff.added.realmRoles, ...diff.added.giteaTeams, ...diff.added.chatChannels];
    return {
      from: { id: employee.accessProfile.id, name: employee.accessProfile.name, color: employee.accessProfile.color },
      to: { id: target.id, name: target.name, color: target.color },
      ...diff,
      extraRealmRoles: extra,
      sensitiveAdded: [...new Set(addedValues.filter((value) => sensitive.has(value)))],
    };
  }

  async create(employeeId: string, dto: CreateMobilityDto, actor: ActorContext) {
    const preview = await this.preview(employeeId, dto);
    const target = await this.profiles.getActive(dto.accessProfileId);
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : null;
    if (effectiveAt && effectiveAt.getTime() - Date.now() > MAX_SCHEDULE_MS) {
      throw new BadRequestException('Une mobilité ne peut pas être planifiée à plus de 6 mois');
    }
    const scheduled = !!effectiveAt && effectiveAt.getTime() - Date.now() > IMMEDIATE_MARGIN_MS;

    const run = await this.dataSource.transaction(async (em) => {
      const employee = await em
        .getRepository(Employee)
        .findOne({ where: { id: employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!employee) throw new NotFoundException('Employé introuvable');
      if (!MOBILE_STATUSES.includes(employee.status)) {
        throw new ConflictException('Une mobilité ne concerne qu’un employé actif');
      }
      if (await this.workflows.hasRunningRun(employee.id, em)) {
        throw new ConflictException('Une exécution est déjà en cours pour cet employé');
      }
      const titleChanged = !!dto.jobTitle && dto.jobTitle !== employee.jobTitle;
      const departmentChanged = !!dto.department && dto.department !== employee.department;
      if (!preview.changed && employee.accessProfileId === target.id && !titleChanged && !departmentChanged) {
        throw new BadRequestException('Aucun changement : choisissez un autre profil ou un autre poste');
      }
      const created = await this.workflows.createRun(em, {
        type: RunType.MOBILITY,
        employeeId: employee.id,
        triggeredBy: actor.name,
        status: scheduled ? RunStatus.SCHEDULED : RunStatus.QUEUED,
        scheduledFor: scheduled ? effectiveAt : null,
        reason: dto.reason ?? `Passage au profil « ${target.name} »`,
        options: {
          targetProfileId: target.id,
          targetProfileCode: target.code,
          jobTitle: dto.jobTitle ?? null,
          department: dto.department ?? null,
          extraRealmRoles: preview.extraRealmRoles,
          justification: preview.extraRealmRoles.length ? (dto.extraAccessJustification ?? null) : null,
          notifyManager: dto.notifyManager ?? true,
        },
      });
      await this.audit.record(
        actor,
        {
          action: scheduled ? 'mobility.scheduled' : 'mobility.requested',
          summary: `Mobilité de ${fullName(employee)} : ${preview.from.name} → ${target.name}${scheduled ? ` le ${effectiveAt!.toISOString()}` : ''}`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: {
            runId: created.id,
            from: preview.from.name,
            to: target.name,
            added: preview.added,
            removed: preview.removed,
            justification: dto.extraAccessJustification ?? null,
          },
        },
        em,
      );
      return created;
    });

    if (scheduled) {
      const full = await this.workflows.getRunOrFail(run.id);
      this.workflows.emitRun(full);
      return this.workflows.toSummary(full);
    }
    return this.workflows.toSummary(await this.workflows.dispatch(run.id, actor));
  }
}
