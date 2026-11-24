import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual } from 'typeorm';
import { paginate, Paginated } from '../../common/dto/pagination.dto';
import {
  ACTIVE_RUN_STATUSES,
  EmployeeStatus,
  RunStatus,
  RunType,
  StepStatus,
  TERMINAL_RUN_STATUSES,
  TERMINAL_STEP_STATUSES,
} from '../../common/enums';
import { ActorContext, AUTOMATION_ACTOR, SYSTEM_ACTOR } from '../../common/types';
import { AppConfig } from '../../config/configuration';
import { diffAccess, effectiveAccess } from '../access-profiles/access-diff';
import { AccessProfile } from '../access-profiles/access-profile.entity';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { AppEventType, EventsService } from '../events/events.service';
import { AutomationEventDto } from './dto/automation-event.dto';
import { RunQueryDto } from './dto/run-query.dto';
import { N8nClient } from './n8n.client';
import { computeFinalStatus, stepProgress } from './run-status.util';
import { STEP_TEMPLATES } from './step-templates';
import { WorkflowRun } from './workflow-run.entity';
import { WorkflowStep } from './workflow-step.entity';

export interface CreateRunParams {
  type: RunType;
  employeeId: string;
  triggeredBy: string;
  status: RunStatus.QUEUED | RunStatus.SCHEDULED;
  reason?: string | null;
  scheduledFor?: Date | null;
  idempotencyKey?: string | null;
  attempt?: number;
  options?: Record<string, unknown> | null;
}

export interface RunSummary {
  id: string;
  type: RunType;
  status: RunStatus;
  attempt: number;
  triggeredBy: string;
  reason: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  error: string | null;
  n8nExecutionId: string | null;
  progress: { done: number; total: number };
  failedSteps: number;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'username' | 'jobTitle' | 'department' | 'status'>;
}

/** Clés de méta renvoyées par n8n et recopiées sur la fiche employé. */
const IDENTIFIER_FIELDS: Record<string, { meta: string; field: 'keycloakUserId' | 'giteaUsername' | 'chatUserId' }> = {
  'keycloak.account': { meta: 'userId', field: 'keycloakUserId' },
  'gitea.account': { meta: 'username', field: 'giteaUsername' },
  'chat.invite': { meta: 'userId', field: 'chatUserId' },
};

type PendingEvent = { type: AppEventType; data: Record<string, unknown> };

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly n8n: N8nClient,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------------------------------------------------------------------------
  // Création et déclenchement
  // ---------------------------------------------------------------------------

  /** Crée une exécution et ses étapes attendues, dans la transaction de l'appelant. */
  async createRun(em: EntityManager, params: CreateRunParams): Promise<WorkflowRun> {
    const runs = em.getRepository(WorkflowRun);
    const steps = STEP_TEMPLATES[params.type].map((template, position) =>
      em.getRepository(WorkflowStep).create({ ...template, position, status: StepStatus.PENDING }),
    );
    const run = runs.create({
      type: params.type,
      status: params.status,
      employeeId: params.employeeId,
      triggeredBy: params.triggeredBy,
      reason: params.reason ?? null,
      scheduledFor: params.scheduledFor ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      attempt: params.attempt ?? 1,
      options: params.options ?? null,
      steps,
    });
    return runs.save(run);
  }

  /** Envoie l'exécution à n8n. En cas d'échec, l'exécution est marquée FAILED et peut être relancée. */
  async dispatch(runId: string, actor: ActorContext): Promise<WorkflowRun> {
    const run = await this.getRunOrFail(runId);
    if (run.status !== RunStatus.QUEUED) {
      throw new ConflictException(`Exécution non déclenchable (statut ${run.status})`);
    }
    try {
      const { executionId } = await this.n8n.trigger(run.type, await this.buildPayload(run));
      await this.dataSource
        .createQueryBuilder()
        .update(WorkflowRun)
        .set({
          status: RunStatus.RUNNING,
          startedAt: () => 'COALESCE("started_at", now())',
          n8nExecutionId: () => 'COALESCE("n8n_execution_id", :executionId)',
        })
        .setParameter('executionId', executionId)
        .where('id = :id AND status IN (:...statuses)', {
          id: run.id,
          statuses: [RunStatus.QUEUED, RunStatus.RUNNING],
        })
        .execute();
      await this.audit.record(actor, {
        action: `${run.type.toLowerCase()}.dispatched`,
        summary: `Workflow n8n déclenché pour ${fullName(run.employee)}${executionId ? ` (exécution #${executionId})` : ''}`,
        targetType: 'employee',
        targetId: run.employeeId,
        targetLabel: fullName(run.employee),
        metadata: { runId: run.id, executionId, attempt: run.attempt },
      });
    } catch (error) {
      await this.failDispatch(run.id, (error as Error).message, actor);
    }
    const updated = await this.getRunOrFail(runId);
    this.emitRun(updated);
    return updated;
  }

  private async failDispatch(runId: string, message: string, actor: ActorContext): Promise<void> {
    this.logger.error(`Déclenchement impossible pour ${runId} : ${message}`);
    await this.dataSource.transaction(async (em) => {
      const run = await em.getRepository(WorkflowRun).findOneOrFail({ where: { id: runId } });
      const employee = await em.getRepository(Employee).findOneOrFail({ where: { id: run.employeeId } });
      run.status = RunStatus.FAILED;
      run.error = message;
      run.finishedAt = new Date();
      await em.getRepository(WorkflowRun).save(run);
      await em
        .getRepository(WorkflowStep)
        .update(
          { runId, status: In([StepStatus.PENDING, StepStatus.RUNNING]) },
          { status: StepStatus.SKIPPED, detail: 'Non exécutée : moteur d’automatisation injoignable' },
        );
      if (run.type === RunType.ONBOARDING) {
        employee.status = EmployeeStatus.FAILED;
        await em.getRepository(Employee).save(employee);
      }
      await this.audit.record(
        actor,
        {
          action: 'automation.dispatch_failed',
          summary: `Échec du déclenchement n8n pour ${fullName(employee)} : ${message}`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: { runId, type: run.type },
        },
        em,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Événements reçus de n8n
  // ---------------------------------------------------------------------------

  async applyEvent(dto: AutomationEventDto): Promise<{ accepted: boolean; status: RunStatus }> {
    const pending: PendingEvent[] = [];
    const result = await this.dataSource.transaction(async (em) => {
      const run = await em.getRepository(WorkflowRun).findOne({
        where: { id: dto.runId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) throw new NotFoundException('Exécution inconnue');
      if (TERMINAL_RUN_STATUSES.includes(run.status) || run.status === RunStatus.SCHEDULED) {
        return { accepted: false, status: run.status };
      }
      const steps = await em.getRepository(WorkflowStep).find({
        where: { runId: run.id },
        order: { position: 'ASC' },
      });
      const employee = await em.getRepository(Employee).findOneOrFail({ where: { id: run.employeeId } });

      if (run.status === RunStatus.QUEUED) {
        run.status = RunStatus.RUNNING;
        run.startedAt ??= new Date();
      }
      if (dto.executionId) run.n8nExecutionId ??= dto.executionId;
      run.updatedAt = new Date(); // signe de vie pour le chien de garde (expireStaleRuns)

      if (dto.event === 'step') {
        await this.applyStep(em, run, steps, employee, dto, pending);
      } else if (dto.event === 'run.finished') {
        await this.finalize(em, run, steps, employee, AUTOMATION_ACTOR, pending);
      }

      await em.getRepository(WorkflowRun).save(run);
      pending.push({ type: 'run.updated', data: { runId: run.id, status: run.status, employeeId: run.employeeId } });
      return { accepted: true, status: run.status };
    });
    pending.forEach((event) => this.events.emit(event.type, event.data));
    return result;
  }

  private async applyStep(
    em: EntityManager,
    run: WorkflowRun,
    steps: WorkflowStep[],
    employee: Employee,
    dto: AutomationEventDto,
    pending: PendingEvent[],
  ): Promise<void> {
    if (!dto.step || !dto.status) throw new BadRequestException('Les champs « step » et « status » sont requis');
    const step = steps.find((candidate) => candidate.key === dto.step);
    if (!step) throw new BadRequestException(`Étape inconnue pour ce workflow : ${dto.step}`);
    if (step.status === dto.status && TERMINAL_STEP_STATUSES.includes(step.status)) return; // rejeu idempotent

    const now = new Date();
    step.status = dto.status;
    step.detail = dto.detail?.slice(0, 1000) ?? step.detail;
    step.meta = dto.meta ? { ...(step.meta ?? {}), ...sanitizeMeta(dto.meta) } : step.meta;
    step.startedAt ??= now;
    if (TERMINAL_STEP_STATUSES.includes(dto.status)) step.finishedAt = now;
    await em.getRepository(WorkflowStep).save(step);

    const identifier = IDENTIFIER_FIELDS[step.key];
    const value = identifier && dto.status === StepStatus.SUCCEEDED ? dto.meta?.[identifier.meta] : undefined;
    if (identifier && typeof value === 'string' && value.length <= 64) {
      employee[identifier.field] = value;
      await em.getRepository(Employee).save(employee);
    }

    if (dto.status === StepStatus.SUCCEEDED || dto.status === StepStatus.FAILED) {
      const granted = run.type === RunType.ONBOARDING;
      await this.audit.record(
        AUTOMATION_ACTOR,
        {
          action:
            dto.status === StepStatus.FAILED
              ? 'automation.step_failed'
              : granted
                ? 'access.granted'
                : 'access.revoked',
          summary: `${step.label} — ${fullName(employee)}${dto.detail ? ` : ${dto.detail}` : ''}`.slice(0, 500),
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: { runId: run.id, step: step.key, system: step.system, status: dto.status },
        },
        em,
      );
    }
    pending.push({
      type: 'step.updated',
      data: { runId: run.id, employeeId: run.employeeId, step: step.key, status: step.status, detail: step.detail },
    });
  }

  /** Clôture l'exécution : statut final, statut de l'employé et trace d'audit. */
  private async finalize(
    em: EntityManager,
    run: WorkflowRun,
    steps: WorkflowStep[],
    employee: Employee,
    actor: ActorContext,
    pending: PendingEvent[],
    forcedStatus?: RunStatus.TIMED_OUT,
  ): Promise<void> {
    const now = new Date();
    for (const step of steps) {
      if (step.status === StepStatus.PENDING || step.status === StepStatus.RUNNING) {
        step.status = forcedStatus ? StepStatus.FAILED : StepStatus.SKIPPED;
        step.detail = forcedStatus ? 'Aucune réponse du moteur d’automatisation' : 'Non exécutée';
        step.finishedAt = now;
        await em.getRepository(WorkflowStep).save(step);
      }
    }
    const status = forcedStatus ?? computeFinalStatus(steps);
    const failed = steps.filter((step) => step.status === StepStatus.FAILED);
    run.status = status;
    run.finishedAt = now;
    run.error = failed.length ? failed.map((step) => `${step.label} : ${step.detail ?? 'échec'}`).join(' | ').slice(0, 2000) : null;

    const name = fullName(employee);
    const succeeded = status === RunStatus.SUCCEEDED || status === RunStatus.PARTIAL;
    if (run.type === RunType.ONBOARDING) {
      const accountCreated = steps.some((s) => s.key === 'keycloak.account' && s.status === StepStatus.SUCCEEDED);
      employee.status = accountCreated && status !== RunStatus.FAILED ? EmployeeStatus.ACTIVE : EmployeeStatus.FAILED;
    } else if (run.type === RunType.MOBILITY) {
      // Les nouveaux droits ne sont inscrits sur la fiche qu'une fois appliqués dans Keycloak.
      const synced = steps.some((s) => s.key === 'keycloak.sync' && s.status === StepStatus.SUCCEEDED);
      if (succeeded && synced) this.applyMobility(employee, run.options ?? {});
    } else if (succeeded) {
      employee.status = EmployeeStatus.DEPARTED;
      employee.departedAt = now;
    } else {
      employee.status = EmployeeStatus.OFFBOARDING;
    }
    await em.getRepository(Employee).save(employee);

    const verb = { [RunType.ONBOARDING]: 'Arrivée', [RunType.MOBILITY]: 'Mobilité', [RunType.OFFBOARDING]: 'Départ' }[run.type];
    const labels: Record<string, string> = {
      [RunStatus.SUCCEEDED]: 'terminée avec succès',
      [RunStatus.PARTIAL]: 'terminée avec des étapes en échec',
      [RunStatus.FAILED]: 'en échec',
      [RunStatus.TIMED_OUT]: 'expirée sans réponse',
    };
    await this.audit.record(
      actor,
      {
        action: `${run.type.toLowerCase()}.${status === RunStatus.SUCCEEDED ? 'completed' : status.toLowerCase()}`,
        summary: `${verb} de ${name} ${labels[status] ?? status}`,
        targetType: 'employee',
        targetId: employee.id,
        targetLabel: name,
        metadata: {
          runId: run.id,
          status,
          failedSteps: failed.map((step) => step.key),
          durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : null,
        },
      },
      em,
    );

    // Fin de contrat connue (CDD, stage) : la révocation est planifiée dès l'arrivée réussie.
    if (run.type === RunType.ONBOARDING && employee.status === EmployeeStatus.ACTIVE) {
      await this.scheduleContractEnd(em, run, employee, pending);
    }
    pending.push({ type: 'employee.updated', data: { employeeId: employee.id, status: employee.status } });
  }

  private applyMobility(employee: Employee, options: Record<string, unknown>): void {
    if (typeof options.targetProfileId === 'string') employee.accessProfileId = options.targetProfileId;
    if (typeof options.jobTitle === 'string' && options.jobTitle) employee.jobTitle = options.jobTitle;
    if (typeof options.department === 'string' && options.department) employee.department = options.department;
    if (Array.isArray(options.extraRealmRoles)) {
      employee.extraRealmRoles = options.extraRealmRoles.filter((role): role is string => typeof role === 'string');
      employee.extraAccessJustification =
        employee.extraRealmRoles.length && typeof options.justification === 'string' ? options.justification : null;
    }
  }

  /** Planifie la révocation à la fin du contrat (18 h, heure de l'entreprise) si l'option est active. */
  private async scheduleContractEnd(
    em: EntityManager,
    run: WorkflowRun,
    employee: Employee,
    pending: PendingEvent[],
  ): Promise<void> {
    if (!run.options?.scheduleDepartureAtEnd || !employee.endDate) return;
    const offset = this.config.get('company', { infer: true }).timezoneOffset;
    const effectiveAt = new Date(`${employee.endDate}T18:00:00${offset}`);
    if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() <= Date.now()) return;
    const existing = await em.getRepository(WorkflowRun).exists({
      where: { employeeId: employee.id, type: RunType.OFFBOARDING, status: RunStatus.SCHEDULED },
    });
    if (existing) return;
    const internship = employee.contractType === 'STAGE';
    const departure = await this.createRun(em, {
      type: RunType.OFFBOARDING,
      employeeId: employee.id,
      triggeredBy: SYSTEM_ACTOR.name,
      status: RunStatus.SCHEDULED,
      reason: internship ? 'Fin de stage (planifiée automatiquement)' : 'Fin de contrat (planifiée automatiquement)',
      scheduledFor: effectiveAt,
      options: { reason: internship ? 'END_OF_INTERNSHIP' : 'END_OF_CONTRACT', notifyManager: true, automatic: true },
    });
    employee.status = EmployeeStatus.OFFBOARDING_SCHEDULED;
    await em.getRepository(Employee).save(employee);
    await this.audit.record(
      SYSTEM_ACTOR,
      {
        action: 'offboarding.scheduled',
        summary: `Révocation des accès de ${fullName(employee)} planifiée à la fin du contrat (${employee.endDate})`,
        targetType: 'employee',
        targetId: employee.id,
        targetLabel: fullName(employee),
        metadata: { runId: departure.id, scheduledFor: effectiveAt.toISOString(), automatic: true },
      },
      em,
    );
    pending.push({ type: 'run.updated', data: { runId: departure.id, status: departure.status, employeeId: employee.id } });
  }

  // ---------------------------------------------------------------------------
  // Tâches planifiées
  // ---------------------------------------------------------------------------

  /** Passe en TIMED_OUT les exécutions sans nouvelles depuis trop longtemps. */
  async expireStaleRuns(): Promise<number> {
    const minutes = this.config.get('automation', { infer: true }).timeoutMinutes;
    const limit = new Date(Date.now() - minutes * 60_000);
    const stale = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .where('run.status IN (:...statuses)', { statuses: ACTIVE_RUN_STATUSES })
      .andWhere('run.updatedAt < :limit', { limit })
      .getMany();

    for (const candidate of stale) {
      const pending: PendingEvent[] = [];
      await this.dataSource.transaction(async (em) => {
        const run = await em.getRepository(WorkflowRun).findOne({
          where: { id: candidate.id, status: In([...ACTIVE_RUN_STATUSES]) },
          lock: { mode: 'pessimistic_write' },
        });
        if (!run) return;
        const steps = await em.getRepository(WorkflowStep).find({ where: { runId: run.id }, order: { position: 'ASC' } });
        const employee = await em.getRepository(Employee).findOneOrFail({ where: { id: run.employeeId } });
        await this.finalize(em, run, steps, employee, SYSTEM_ACTOR, pending, RunStatus.TIMED_OUT);
        await em.getRepository(WorkflowRun).save(run);
        pending.push({ type: 'run.updated', data: { runId: run.id, status: run.status, employeeId: run.employeeId } });
      });
      pending.forEach((event) => this.events.emit(event.type, event.data));
    }
    return stale.length;
  }

  /** Déclenche les arrivées, mobilités et départs planifiés arrivés à échéance. */
  async dispatchDueRuns(): Promise<number> {
    const due = await this.dataSource.getRepository(WorkflowRun).find({
      where: { status: RunStatus.SCHEDULED, scheduledFor: LessThanOrEqual(new Date()) },
      order: { scheduledFor: 'ASC' },
      take: 20,
    });
    let dispatched = 0;
    for (const run of due) {
      // Mise à jour conditionnelle : une seule instance de l'API peut « réclamer » l'exécution.
      const claimed = await this.dataSource.transaction(async (em) => {
        const result = await em
          .createQueryBuilder()
          .update(WorkflowRun)
          .set({ status: RunStatus.QUEUED })
          .where('id = :id AND status = :status', { id: run.id, status: RunStatus.SCHEDULED })
          .execute();
        if (!result.affected) return false;
        const status =
          run.type === RunType.ONBOARDING
            ? EmployeeStatus.PROVISIONING
            : run.type === RunType.OFFBOARDING
              ? EmployeeStatus.OFFBOARDING
              : null;
        if (status) await em.getRepository(Employee).update({ id: run.employeeId }, { status });
        return true;
      });
      if (claimed) {
        await this.dispatch(run.id, SYSTEM_ACTOR);
        dispatched += 1;
      }
    }
    return dispatched;
  }

  /**
   * Reprise sur incident : une exécution restée « en file » sans identifiant n8n
   * (arrêt de l'API entre l'enregistrement et le déclenchement) est redéclenchée.
   */
  async redispatchStuckRuns(): Promise<number> {
    const limit = new Date(Date.now() - 90_000);
    const stuck = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .where('run.status = :status', { status: RunStatus.QUEUED })
      .andWhere('run.n8nExecutionId IS NULL')
      .andWhere('run.updatedAt < :limit', { limit })
      .take(10)
      .getMany();
    for (const run of stuck) {
      this.logger.warn(`Reprise du déclenchement de l'exécution ${run.id}`);
      await this.dispatch(run.id, SYSTEM_ACTOR);
    }
    return stuck.length;
  }

  /** Avance une exécution planifiée à maintenant (ex. départ anticipé) et la déclenche. */
  async runNow(runId: string, actor: ActorContext): Promise<WorkflowRun> {
    const run = await this.getRunOrFail(runId);
    if (run.status !== RunStatus.SCHEDULED) {
      throw new ConflictException('Seule une exécution planifiée peut être avancée');
    }
    await this.dataSource.getRepository(WorkflowRun).update({ id: runId, status: RunStatus.SCHEDULED }, { scheduledFor: new Date() });
    await this.audit.record(actor, {
      action: `${run.type.toLowerCase()}.advanced`,
      summary: `Exécution planifiée avancée à maintenant pour ${fullName(run.employee)}`,
      targetType: 'employee',
      targetId: run.employeeId,
      targetLabel: fullName(run.employee),
      metadata: { runId, previousSchedule: run.scheduledFor?.toISOString() ?? null },
    });
    await this.dispatchDueRuns();
    return this.getRunOrFail(runId);
  }

  /** Annule une exécution planifiée qui n'a pas encore commencé. */
  async cancelScheduled(runId: string, actor: ActorContext): Promise<WorkflowRun> {
    await this.dataSource.transaction(async (em) => {
      const run = await em.getRepository(WorkflowRun).findOne({ where: { id: runId }, lock: { mode: 'pessimistic_write' } });
      if (!run) throw new NotFoundException('Exécution introuvable');
      if (run.status !== RunStatus.SCHEDULED) {
        throw new ConflictException('Seule une exécution planifiée, pas encore commencée, peut être annulée');
      }
      run.status = RunStatus.CANCELLED;
      run.finishedAt = new Date();
      await em.getRepository(WorkflowRun).save(run);
      const employee = await em.getRepository(Employee).findOneOrFail({ where: { id: run.employeeId } });
      if (run.type === RunType.ONBOARDING) employee.status = EmployeeStatus.CANCELLED;
      if (run.type === RunType.OFFBOARDING) employee.status = EmployeeStatus.ACTIVE;
      await em.getRepository(Employee).save(employee);
      const label = { [RunType.ONBOARDING]: 'Arrivée planifiée annulée', [RunType.MOBILITY]: 'Mobilité planifiée annulée', [RunType.OFFBOARDING]: 'Départ planifié annulé' }[run.type];
      await this.audit.record(
        actor,
        {
          action: `${run.type.toLowerCase()}.cancelled`,
          summary: `${label} pour ${fullName(employee)}`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: { runId },
        },
        em,
      );
    });
    const run = await this.getRunOrFail(runId);
    this.emitRun(run);
    this.events.emit('employee.updated', { employeeId: run.employeeId, status: run.employee.status });
    return run;
  }

  // ---------------------------------------------------------------------------
  // Relance
  // ---------------------------------------------------------------------------

  async retry(runId: string, actor: ActorContext): Promise<WorkflowRun> {
    const previous = await this.getRunOrFail(runId);
    const retryable = [RunStatus.FAILED, RunStatus.PARTIAL, RunStatus.TIMED_OUT];
    if (!retryable.includes(previous.status)) {
      throw new ConflictException('Seules les exécutions en échec, partielles ou expirées peuvent être relancées');
    }
    const employee = previous.employee;
    if (previous.type === RunType.ONBOARDING && [EmployeeStatus.DEPARTED, EmployeeStatus.OFFBOARDING, EmployeeStatus.CANCELLED].includes(employee.status)) {
      throw new ConflictException('Impossible de relancer une arrivée pour un employé parti ou annulé');
    }
    if (previous.type === RunType.MOBILITY && ![EmployeeStatus.ACTIVE, EmployeeStatus.OFFBOARDING_SCHEDULED].includes(employee.status)) {
      throw new ConflictException('Une mobilité ne peut être relancée que pour un employé actif');
    }
    const newRun = await this.dataSource.transaction(async (em) => {
      const busy = await em.getRepository(WorkflowRun).exists({
        where: { employeeId: employee.id, status: In([...ACTIVE_RUN_STATUSES]) },
      });
      if (busy) throw new ConflictException('Une exécution est déjà en cours pour cet employé');
      const run = await this.createRun(em, {
        type: previous.type,
        employeeId: employee.id,
        triggeredBy: actor.name,
        status: RunStatus.QUEUED,
        reason: previous.reason,
        attempt: previous.attempt + 1,
        options: previous.options,
      });
      if (previous.type !== RunType.MOBILITY) {
        await em.getRepository(Employee).update(
          { id: employee.id },
          { status: previous.type === RunType.ONBOARDING ? EmployeeStatus.PROVISIONING : EmployeeStatus.OFFBOARDING },
        );
      }
      await this.audit.record(
        actor,
        {
          action: 'run.retried',
          summary: `Relance (tentative ${run.attempt}) du workflow ${{ [RunType.ONBOARDING]: 'd’arrivée', [RunType.MOBILITY]: 'de mobilité', [RunType.OFFBOARDING]: 'de départ' }[previous.type]} de ${fullName(employee)}`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: { previousRunId: previous.id, runId: run.id },
        },
        em,
      );
      return run;
    });
    return this.dispatch(newRun.id, actor);
  }

  // ---------------------------------------------------------------------------
  // Lecture
  // ---------------------------------------------------------------------------

  async list(query: RunQueryDto): Promise<Paginated<RunSummary>> {
    const qb = this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run');
    if (query.type) qb.andWhere('run.type = :type', { type: query.type });
    if (query.status?.length) qb.andWhere('run.status IN (:...status)', { status: query.status });
    if (query.employeeId) qb.andWhere('run.employeeId = :employeeId', { employeeId: query.employeeId });

    const total = await qb.clone().getCount();
    const ids = await qb
      .clone()
      .select('run.id', 'id')
      .orderBy('run.createdAt', 'DESC')
      .addOrderBy('run.id', 'DESC')
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<{ id: string }>();
    if (ids.length === 0) return paginate([], total, query.page, query.pageSize);

    const runs = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.employee', 'employee')
      .leftJoinAndSelect('run.steps', 'step')
      .where('run.id IN (:...ids)', { ids: ids.map((row) => row.id) })
      .orderBy('run.createdAt', 'DESC')
      .addOrderBy('run.id', 'DESC')
      .addOrderBy('step.position', 'ASC')
      .getMany();
    return paginate(runs.map((run) => this.toSummary(run)), total, query.page, query.pageSize);
  }

  async getRunOrFail(id: string): Promise<WorkflowRun> {
    const run = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.employee', 'employee')
      .innerJoinAndSelect('employee.accessProfile', 'profile')
      .leftJoinAndSelect('run.steps', 'step')
      .where('run.id = :id', { id })
      .orderBy('step.position', 'ASC')
      .getOne();
    if (!run) throw new NotFoundException('Exécution introuvable');
    return run;
  }

  /** Vrai si une exécution est en file, en cours ou planifiée pour cet employé. */
  async hasActiveRun(employeeId: string, em?: EntityManager): Promise<boolean> {
    return (em ?? this.dataSource.manager).getRepository(WorkflowRun).exists({
      where: { employeeId, status: In([...ACTIVE_RUN_STATUSES, RunStatus.SCHEDULED]) },
    });
  }

  /** Vrai si une exécution est réellement en file ou en cours (les planifiées sont ignorées). */
  async hasRunningRun(employeeId: string, em?: EntityManager): Promise<boolean> {
    return (em ?? this.dataSource.manager).getRepository(WorkflowRun).exists({
      where: { employeeId, status: In([...ACTIVE_RUN_STATUSES]) },
    });
  }

  toSummary(run: WorkflowRun): RunSummary {
    const steps = run.steps ?? [];
    const { id, firstName, lastName, username, jobTitle, department, status } = run.employee;
    return {
      id: run.id,
      type: run.type,
      status: run.status,
      attempt: run.attempt,
      triggeredBy: run.triggeredBy,
      reason: run.reason,
      scheduledFor: run.scheduledFor,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
      error: run.error,
      n8nExecutionId: run.n8nExecutionId,
      progress: stepProgress(steps),
      failedSteps: steps.filter((step) => step.status === StepStatus.FAILED).length,
      employee: { id, firstName, lastName, username, jobTitle, department, status },
    };
  }

  /** Contrat d'entrée des workflows n8n (documenté dans automation/n8n/README.md). */
  async buildPayload(run: WorkflowRun): Promise<Record<string, unknown>> {
    const employee = run.employee;
    const profile = employee.accessProfile;
    const current = effectiveAccess(profile, employee.extraRealmRoles ?? []);
    // Mobilité : n8n reçoit les droits cibles et l'écart exact à appliquer.
    let target = current;
    let mobility: Record<string, unknown> | undefined;
    if (run.type === RunType.MOBILITY) {
      const options = run.options ?? {};
      const targetProfile = await this.dataSource
        .getRepository(AccessProfile)
        .findOneOrFail({ where: { id: String(options.targetProfileId) } });
      const extra = Array.isArray(options.extraRealmRoles) ? (options.extraRealmRoles as string[]) : [];
      target = effectiveAccess(targetProfile, extra);
      mobility = {
        previousProfile: { code: profile.code, name: profile.name },
        targetProfile: { code: targetProfile.code, name: targetProfile.name },
        previousAccess: current,
        changes: diffAccess(current, target),
        jobTitle: options.jobTitle ?? employee.jobTitle,
        department: options.department ?? employee.department,
      };
    }
    const targetProfileInfo = mobility ? (mobility.targetProfile as { code: string; name: string }) : profile;
    const automation = this.config.get('automation', { infer: true });
    const company = this.config.get('company', { infer: true });
    const links = this.config.get('publicLinks', { infer: true });
    const realm = this.config.get('keycloak', { infer: true }).realm;
    return {
      runId: run.id,
      type: run.type,
      attempt: run.attempt,
      callbackUrl: automation.callbackUrl,
      company: { name: company.name, emailDomain: company.emailDomain },
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: fullName(employee),
        username: employee.username,
        workEmail: employee.workEmail,
        personalEmail: employee.personalEmail,
        jobTitle: employee.jobTitle,
        department: employee.department,
        location: employee.location,
        contractType: employee.contractType,
        startDate: employee.startDate,
        endDate: employee.endDate,
        managerName: employee.managerName,
        managerEmail: employee.managerEmail,
        keycloakUserId: employee.keycloakUserId,
        giteaUsername: employee.giteaUsername,
        chatUserId: employee.chatUserId,
      },
      access: {
        profileCode: targetProfileInfo.code,
        profileName: targetProfileInfo.name,
        ...target,
      },
      ...(mobility ? { mobility } : {}),
      reason: run.reason,
      options: run.options ?? {},
      links: {
        portal: this.config.get('portalUrl', { infer: true }),
        account: links.keycloak ? `${links.keycloak}/realms/${realm}/account` : null,
        gitea: links.gitea || null,
        mattermost: links.mattermost || null,
      },
      steps: (run.steps ?? []).map((step) => step.key),
    };
  }

  emitRun(run: WorkflowRun): void {
    this.events.emit('run.updated', { runId: run.id, status: run.status, employeeId: run.employeeId });
  }
}

export function fullName(employee: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${employee.firstName} ${employee.lastName}`;
}

/** Ne conserve que des métadonnées scalaires et courtes (jamais de secret renvoyé par n8n). */
function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const blocked = /pass|secret|token|credential/i;
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([key, value]) => !blocked.test(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 20)
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 200) : value]),
  );
}
