import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeeStatus, RunStatus, RunType } from '../../common/enums';
import { ComplianceService } from '../compliance/compliance.service';
import { Employee } from '../employees/employee.entity';
import { WorkflowRun } from '../workflows/workflow-run.entity';
import { WorkflowsService } from '../workflows/workflows.service';

export interface MonthlyPoint {
  month: string;
  arrivals: number;
  departures: number;
}

export type AgendaKind = 'ARRIVAL' | 'MOBILITY' | 'DEPARTURE';

export interface AgendaItem {
  kind: AgendaKind;
  date: string;
  employeeId: string;
  runId: string | null;
  name: string;
  jobTitle: string;
  department: string;
  profile: { name: string; color: string };
  status: string;
  detail: string | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workflows: WorkflowsService,
    private readonly compliance: ComplianceService,
  ) {}

  async summary() {
    const [kpis, agenda, monthly, recentRuns, contractsEnding, compliance] = await Promise.all([
      this.kpis(),
      this.agenda(),
      this.monthly(),
      this.workflows.list({ page: 1, pageSize: 6 }),
      this.contractsEnding(),
      this.compliance.summary(),
    ]);
    return { generatedAt: new Date().toISOString(), kpis, agenda, monthly, recentRuns: recentRuns.items, contractsEnding, compliance };
  }

  private async kpis() {
    const [row] = (await this.dataSource.query(
      `SELECT
        (SELECT count(*) FROM employees WHERE status IN ('ACTIVE', 'OFFBOARDING_SCHEDULED'))::int AS "activeEmployees",
        (SELECT count(*) FROM workflow_runs WHERE status IN ('QUEUED', 'RUNNING'))::int AS "runsInProgress",
        (SELECT count(*) FROM workflow_runs WHERE type = 'ONBOARDING' AND status = 'SCHEDULED')::int AS "scheduledArrivals",
        (SELECT count(*) FROM workflow_runs WHERE type = 'OFFBOARDING' AND status = 'SCHEDULED')::int AS "scheduledDepartures",
        (SELECT count(*) FROM workflow_runs WHERE type = 'MOBILITY' AND status IN ('SUCCEEDED', 'PARTIAL')
           AND finished_at >= date_trunc('month', now()))::int AS "mobilitiesThisMonth",
        (SELECT count(*) FROM workflow_runs WHERE type = 'OFFBOARDING' AND status IN ('SUCCEEDED', 'PARTIAL')
           AND finished_at >= date_trunc('month', now()))::int AS "revokedThisMonth",
        (SELECT round(avg(extract(epoch FROM finished_at - started_at)))::int FROM workflow_runs
           WHERE type = 'ONBOARDING' AND status IN ('SUCCEEDED', 'PARTIAL') AND started_at IS NOT NULL
             AND finished_at >= now() - interval '90 days') AS "avgProvisioningSeconds",
        (SELECT count(*) FROM (
           SELECT DISTINCT ON (employee_id, type) status FROM workflow_runs
           WHERE status <> 'CANCELLED' ORDER BY employee_id, type, created_at DESC
         ) latest WHERE status IN ('FAILED', 'PARTIAL', 'TIMED_OUT'))::int AS "needsAttention"`,
    )) as Record<string, number | null>[];
    return row;
  }

  /** Prochains mouvements (45 jours) : arrivées, mobilités et départs, dans l'ordre chronologique. */
  private async agenda(): Promise<AgendaItem[]> {
    const arrivals = await this.dataSource
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.accessProfile', 'profile')
      .where('employee.startDate BETWEEN CURRENT_DATE AND (CURRENT_DATE + 45)')
      .andWhere('employee.status NOT IN (:...excluded)', { excluded: [EmployeeStatus.CANCELLED, EmployeeStatus.DEPARTED] })
      .orderBy('employee.startDate', 'ASC')
      .limit(20)
      .getMany();
    const scheduled = await this.dataSource
      .getRepository(WorkflowRun)
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.employee', 'employee')
      .innerJoinAndSelect('employee.accessProfile', 'profile')
      .where('run.status = :status', { status: RunStatus.SCHEDULED })
      .andWhere('run.type IN (:...types)', { types: [RunType.MOBILITY, RunType.OFFBOARDING] })
      .andWhere("run.scheduledFor <= now() + interval '45 days'")
      .orderBy('run.scheduledFor', 'ASC')
      .limit(20)
      .getMany();
    const pendingOnboarding = await this.dataSource.getRepository(WorkflowRun).find({
      where: { type: RunType.ONBOARDING, status: RunStatus.SCHEDULED },
    });
    const provisionAt = new Map(pendingOnboarding.map((run) => [run.employeeId, run]));

    const items: AgendaItem[] = [
      ...arrivals.map((e) => {
        const run = provisionAt.get(e.id);
        return {
          kind: 'ARRIVAL' as const,
          date: `${e.startDate}T09:00:00`,
          employeeId: e.id,
          runId: run?.id ?? null,
          name: `${e.firstName} ${e.lastName}`,
          jobTitle: e.jobTitle,
          department: e.department,
          profile: { name: e.accessProfile.name, color: e.accessProfile.color },
          status: e.status,
          detail: run?.scheduledFor ? `Comptes créés le ${run.scheduledFor.toISOString()}` : null,
        };
      }),
      ...scheduled.map((run) => ({
        kind: (run.type === RunType.MOBILITY ? 'MOBILITY' : 'DEPARTURE') as AgendaKind,
        date: run.scheduledFor!.toISOString(),
        employeeId: run.employeeId,
        runId: run.id,
        name: `${run.employee.firstName} ${run.employee.lastName}`,
        jobTitle: run.employee.jobTitle,
        department: run.employee.department,
        profile: { name: run.employee.accessProfile.name, color: run.employee.accessProfile.color },
        status: run.status,
        detail: run.reason,
      })),
    ];
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  }

  private async monthly(): Promise<MonthlyPoint[]> {
    return (await this.dataSource.query(
      `WITH months AS (
         SELECT generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS month
       )
       SELECT to_char(m.month, 'YYYY-MM') AS month,
         (SELECT count(*) FROM employees e WHERE date_trunc('month', e.start_date) = m.month AND e.status <> 'CANCELLED')::int AS arrivals,
         (SELECT count(*) FROM employees e WHERE e.departed_at IS NOT NULL AND date_trunc('month', e.departed_at) = m.month)::int AS departures
       FROM months m ORDER BY m.month`,
    )) as MonthlyPoint[];
  }

  /** Contrats se terminant sous 30 jours sans révocation planifiée. */
  private async contractsEnding() {
    const rows = await this.dataSource
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .where('employee.status = :active', { active: EmployeeStatus.ACTIVE })
      .andWhere('employee.endDate IS NOT NULL')
      .andWhere('employee.endDate <= CURRENT_DATE + 30')
      .orderBy('employee.endDate', 'ASC')
      .take(5)
      .getMany();
    return rows.map((e) => ({ employeeId: e.id, name: `${e.firstName} ${e.lastName}`, contractType: e.contractType, endDate: e.endDate }));
  }
}
