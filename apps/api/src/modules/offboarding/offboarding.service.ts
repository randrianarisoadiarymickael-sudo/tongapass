import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeeStatus, RunStatus, RunType } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { EmployeesService } from '../employees/employees.service';
import { fullName, WorkflowsService } from '../workflows/workflows.service';
import { CreateOffboardingDto, DEPARTURE_REASON_LABELS } from './dto/create-offboarding.dto';

/** Marge en dessous de laquelle une date est considérée comme « immédiate ». */
const IMMEDIATE_MARGIN_MS = 60_000;
const MAX_SCHEDULE_MS = 180 * 86_400_000;

@Injectable()
export class OffboardingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly employees: EmployeesService,
    private readonly workflows: WorkflowsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateOffboardingDto, actor: ActorContext) {
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : null;
    const now = Date.now();
    if (effectiveAt && effectiveAt.getTime() - now > MAX_SCHEDULE_MS) {
      throw new BadRequestException('Un départ ne peut pas être planifié à plus de 6 mois');
    }
    const scheduled = !!effectiveAt && effectiveAt.getTime() - now > IMMEDIATE_MARGIN_MS;

    const run = await this.dataSource.transaction(async (em) => {
      const employee = await em
        .getRepository(Employee)
        .findOne({ where: { id: dto.employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!employee) throw new NotFoundException('Employé introuvable');
      if (dto.confirmUsername.trim() !== employee.username) {
        throw new BadRequestException('La confirmation ne correspond pas à l’identifiant de l’employé');
      }
      if (![EmployeeStatus.ACTIVE, EmployeeStatus.FAILED].includes(employee.status)) {
        throw new ConflictException(`Départ impossible : statut actuel ${employee.status}`);
      }
      if (await this.workflows.hasActiveRun(employee.id, em)) {
        throw new ConflictException(
          'Une exécution est déjà en cours ou planifiée pour cet employé (annulez le départ planifié pour le modifier)',
        );
      }

      const reasonLabel = DEPARTURE_REASON_LABELS[dto.reason];
      const created = await this.workflows.createRun(em, {
        type: RunType.OFFBOARDING,
        employeeId: employee.id,
        triggeredBy: actor.name,
        status: scheduled ? RunStatus.SCHEDULED : RunStatus.QUEUED,
        reason: dto.comment ? `${reasonLabel} — ${dto.comment}` : reasonLabel,
        scheduledFor: scheduled ? effectiveAt : null,
        options: { reason: dto.reason, notifyManager: dto.notifyManager ?? true },
      });
      employee.status = scheduled ? EmployeeStatus.OFFBOARDING_SCHEDULED : EmployeeStatus.OFFBOARDING;
      await em.getRepository(Employee).save(employee);
      await this.audit.record(
        actor,
        {
          action: scheduled ? 'offboarding.scheduled' : 'offboarding.requested',
          summary: scheduled
            ? `Départ de ${fullName(employee)} planifié le ${effectiveAt!.toISOString()} (${reasonLabel})`
            : `Départ immédiat de ${fullName(employee)} demandé (${reasonLabel})`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: { runId: created.id, reason: dto.reason, scheduledFor: effectiveAt?.toISOString() ?? null },
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

  async cancel(runId: string, actor: ActorContext) {
    const run = await this.workflows.getRunOrFail(runId);
    if (run.type !== RunType.OFFBOARDING) throw new NotFoundException('Départ introuvable');
    return this.workflows.toSummary(await this.workflows.cancelScheduled(runId, actor));
  }
}
