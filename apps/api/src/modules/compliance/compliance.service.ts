import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { ComplianceStatus, EmployeeStatus } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { effectiveAccess } from '../access-profiles/access-diff';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { EventsService } from '../events/events.service';
import { fullName } from '../workflows/workflows.service';
import { ComplianceCheck } from './compliance-check.entity';
import { ACTIVE_EXPECTATION, evaluateCompliance, ExpectedAccess } from './compliance.util';
import { DirectoryUnavailableError, KeycloakDirectoryClient } from './keycloak-directory.client';

/** Statuts contrôlés : comptes censés exister (actifs) ou censés être révoqués (partis). */
const CHECKED_STATUSES = [...ACTIVE_EXPECTATION, EmployeeStatus.DEPARTED];

export interface ScanSummary {
  checkedAt: string;
  total: number;
  counts: Record<ComplianceStatus, number>;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly directory: KeycloakDirectoryClient,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  expectedFor(employee: Employee): ExpectedAccess {
    if (employee.status === EmployeeStatus.DEPARTED) return { enabled: false, realmRoles: [], groups: [] };
    const access = effectiveAccess(employee.accessProfile, employee.extraRealmRoles);
    return { enabled: true, realmRoles: [...access.realmRoles].sort(), groups: [...access.groups].sort() };
  }

  /** Contrôle un employé et conserve le résultat (historique des contrôles). */
  async checkEmployee(employeeId: string, actor: ActorContext, record = true): Promise<ComplianceCheck> {
    const employee = await this.dataSource
      .getRepository(Employee)
      .findOne({ where: { id: employeeId }, relations: { accessProfile: true } });
    if (!employee) throw new NotFoundException('Employé introuvable');
    return this.runCheck(employee, actor, record);
  }

  private async runCheck(employee: Employee, actor: ActorContext, record: boolean): Promise<ComplianceCheck> {
    const expected = this.expectedFor(employee);
    let result: Pick<ComplianceCheck, 'status' | 'details'>;
    try {
      const actual = await this.directory.findUser(employee.keycloakUserId, employee.username);
      result = evaluateCompliance(expected, actual);
    } catch (error) {
      if (!(error instanceof DirectoryUnavailableError)) throw error;
      result = {
        status: ComplianceStatus.UNREACHABLE,
        details: {
          expected,
          actual: null,
          missingRoles: [],
          unexpectedRoles: [],
          missingGroups: [],
          unexpectedGroups: [],
          enabledMismatch: false,
          message: error.message,
        },
      };
    }
    const check = await this.dataSource.getRepository(ComplianceCheck).save(
      this.dataSource.getRepository(ComplianceCheck).create({
        employeeId: employee.id,
        status: result.status,
        details: result.details,
        triggeredBy: actor.name,
      }),
    );
    if (record && result.status !== ComplianceStatus.UNREACHABLE) {
      await this.audit.record(actor, {
        action: result.status === ComplianceStatus.COMPLIANT ? 'compliance.checked' : 'compliance.drift',
        summary: `Contrôle de conformité de ${fullName(employee)} : ${result.details.message}`,
        targetType: 'employee',
        targetId: employee.id,
        targetLabel: fullName(employee),
        metadata: {
          status: result.status,
          unexpectedRoles: result.details.unexpectedRoles,
          missingRoles: result.details.missingRoles,
          enabledMismatch: result.details.enabledMismatch,
        },
      });
    }
    return check;
  }

  /** Contrôle de tous les comptes provisionnés (manuel ou planifié chaque nuit). */
  async scan(actor: ActorContext): Promise<ScanSummary> {
    const employees = await this.dataSource.getRepository(Employee).find({
      where: { status: In(CHECKED_STATUSES) },
      relations: { accessProfile: true },
      take: 1000,
    });
    const counts = Object.fromEntries(Object.values(ComplianceStatus).map((status) => [status, 0])) as Record<ComplianceStatus, number>;
    for (const employee of employees) {
      const check = await this.runCheck(employee, actor, false);
      counts[check.status] += 1;
    }
    const summary: ScanSummary = { checkedAt: new Date().toISOString(), total: employees.length, counts };
    await this.audit.record(actor, {
      action: 'compliance.scanned',
      summary: `Contrôle de conformité de ${employees.length} compte(s) : ${counts.DRIFT} écart(s), ${counts.NO_ACCOUNT} compte(s) manquant(s)`,
      metadata: { ...summary },
    });
    this.events.emit('employee.updated', { scope: 'compliance' });
    this.logger.log(summary.counts.UNREACHABLE ? 'Contrôle de conformité : Keycloak injoignable' : `Contrôle de conformité : ${summary.total} comptes`);
    return summary;
  }

  /** Dernier résultat par employé (les écarts en premier). */
  async latest(): Promise<(ComplianceCheck & { employee: Employee })[]> {
    const rows = await this.dataSource
      .getRepository(ComplianceCheck)
      .createQueryBuilder('check')
      .distinctOn(['check.employeeId'])
      .innerJoinAndSelect('check.employee', 'employee')
      .innerJoinAndSelect('employee.accessProfile', 'profile')
      .orderBy('check.employeeId')
      .addOrderBy('check.checkedAt', 'DESC')
      .getMany();
    const rank: Record<ComplianceStatus, number> = { DRIFT: 0, NO_ACCOUNT: 1, UNREACHABLE: 2, COMPLIANT: 3 };
    return (rows as (ComplianceCheck & { employee: Employee })[]).sort(
      (a, b) => rank[a.status] - rank[b.status] || b.checkedAt.getTime() - a.checkedAt.getTime(),
    );
  }

  async summary() {
    const latest = await this.latest();
    const counts = Object.fromEntries(Object.values(ComplianceStatus).map((status) => [status, 0])) as Record<ComplianceStatus, number>;
    latest.forEach((check) => (counts[check.status] += 1));
    const lastCheckAt = latest.reduce<Date | null>((max, check) => (!max || check.checkedAt > max ? check.checkedAt : max), null);
    return { enabled: this.directory.enabled, total: latest.length, counts, lastCheckAt };
  }

  async lastForEmployee(employeeId: string): Promise<ComplianceCheck | null> {
    return this.dataSource.getRepository(ComplianceCheck).findOne({ where: { employeeId }, order: { checkedAt: 'DESC' } });
  }
}
