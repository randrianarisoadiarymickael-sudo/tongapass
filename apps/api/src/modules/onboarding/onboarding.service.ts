import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { EmployeeStatus, RunStatus, RunType } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { toTitleCase } from '../../common/utils/identity.util';
import { ACCESS_CATALOG } from '../access-profiles/access-catalog';
import { AccessProfilesService } from '../access-profiles/access-profiles.service';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/employee.entity';
import { EmployeesService } from '../employees/employees.service';
import { STEP_TEMPLATES } from '../workflows/step-templates';
import { WorkflowRun } from '../workflows/workflow-run.entity';
import { fullName, WorkflowsService } from '../workflows/workflows.service';
import { CreateOnboardingDto, PreviewOnboardingDto } from './dto/create-onboarding.dto';

const DAY = 86_400_000;
/** En dessous de cette avance, la création est considérée comme immédiate. */
const IMMEDIATE_MARGIN_MS = 60_000;

@Injectable()
export class OnboardingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly employees: EmployeesService,
    private readonly profiles: AccessProfilesService,
    private readonly workflows: WorkflowsService,
    private readonly audit: AuditService,
  ) {}

  /** Aperçu avant validation : identifiants générés, droits accordés, étapes prévues. */
  async preview(dto: PreviewOnboardingDto) {
    const profile = await this.profiles.getActive(dto.accessProfileId);
    const identity = await this.employees.allocateIdentity(dto.firstName, dto.lastName);
    const extra = (dto.extraRealmRoles ?? []).filter((role) => !profile.realmRoles.includes(role));
    const realmRoles = [...profile.realmRoles, ...extra];
    const sensitive = new Set(
      Object.values(ACCESS_CATALOG)
        .flat()
        .filter((item) => 'sensitive' in item && item.sensitive)
        .map((item) => item.value),
    );
    return {
      identity,
      profile: { id: profile.id, code: profile.code, name: profile.name, color: profile.color },
      access: {
        realmRoles,
        extraRealmRoles: extra,
        groups: profile.groups,
        giteaTeams: profile.giteaTeams,
        chatChannels: profile.chatChannels,
      },
      sensitiveAccess: [...realmRoles, ...profile.giteaTeams, ...profile.chatChannels].filter((v) => sensitive.has(v)),
      steps: STEP_TEMPLATES[RunType.ONBOARDING],
    };
  }

  async create(dto: CreateOnboardingDto, actor: ActorContext, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.dataSource.getRepository(WorkflowRun).findOne({ where: { idempotencyKey } });
      if (existing) return this.workflows.getRunOrFail(existing.id).then((run) => this.workflows.toSummary(run));
    }

    this.assertDates(dto);
    const provisionAt = dto.provisionAt ? new Date(dto.provisionAt) : null;
    const scheduled = !!provisionAt && provisionAt.getTime() - Date.now() > IMMEDIATE_MARGIN_MS;
    const profile = await this.profiles.getActive(dto.accessProfileId);
    const extraRealmRoles = (dto.extraRealmRoles ?? []).filter((role) => !profile.realmRoles.includes(role));

    const duplicate = await this.dataSource.getRepository(Employee).findOne({
      where: { personalEmail: dto.personalEmail, status: Not(In([EmployeeStatus.DEPARTED, EmployeeStatus.CANCELLED])) },
    });
    if (duplicate) {
      throw new ConflictException(
        `${fullName(duplicate)} (${duplicate.employeeNumber}) utilise déjà cette adresse personnelle`,
      );
    }

    const firstName = toTitleCase(dto.firstName);
    const lastName = toTitleCase(dto.lastName);

    const run = await this.dataSource.transaction(async (em) => {
      const identity = await this.employees.allocateIdentity(firstName, lastName, em);
      const employee = await em.getRepository(Employee).save(
        em.getRepository(Employee).create({
          employeeNumber: await this.employees.nextEmployeeNumber(em),
          firstName,
          lastName,
          personalEmail: dto.personalEmail,
          workEmail: identity.workEmail,
          username: identity.username,
          jobTitle: dto.jobTitle,
          department: dto.department,
          location: dto.location ?? null,
          contractType: dto.contractType,
          startDate: dto.startDate,
          endDate: dto.endDate ?? null,
          managerName: dto.managerName ?? null,
          managerEmail: dto.managerEmail ?? null,
          accessProfileId: profile.id,
          extraRealmRoles,
          extraAccessJustification: extraRealmRoles.length ? (dto.extraAccessJustification ?? null) : null,
          status: scheduled ? EmployeeStatus.PENDING : EmployeeStatus.PROVISIONING,
          createdBy: actor.name,
        }),
      );
      const created = await this.workflows.createRun(em, {
        type: RunType.ONBOARDING,
        employeeId: employee.id,
        triggeredBy: actor.name,
        status: scheduled ? RunStatus.SCHEDULED : RunStatus.QUEUED,
        scheduledFor: scheduled ? provisionAt : null,
        idempotencyKey: idempotencyKey ?? null,
        options: {
          sendWelcomeEmail: dto.options?.sendWelcomeEmail ?? true,
          announceInChat: dto.options?.announceInChat ?? true,
          scheduleDepartureAtEnd: !!dto.endDate && (dto.options?.scheduleDepartureAtEnd ?? false),
        },
      });
      await this.audit.record(
        actor,
        {
          action: scheduled ? 'onboarding.scheduled' : 'onboarding.requested',
          summary: scheduled
            ? `Arrivée de ${fullName(employee)} (${employee.jobTitle}) déclarée : comptes créés le ${provisionAt!.toISOString()}`
            : `Arrivée de ${fullName(employee)} (${employee.jobTitle}) demandée pour le ${employee.startDate}`,
          targetType: 'employee',
          targetId: employee.id,
          targetLabel: fullName(employee),
          metadata: {
            runId: created.id,
            username: employee.username,
            profile: profile.code,
            extraRealmRoles,
            justification: employee.extraAccessJustification,
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
    const dispatched = await this.workflows.dispatch(run.id, actor);
    return this.workflows.toSummary(dispatched);
  }

  private assertDates(dto: CreateOnboardingDto): void {
    const start = Date.parse(`${dto.startDate}T00:00:00Z`);
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (start < today - 30 * DAY) {
      throw new BadRequestException('La date d’arrivée ne peut pas dépasser 30 jours dans le passé');
    }
    if (start > today + 365 * DAY) {
      throw new BadRequestException('La date d’arrivée doit être dans les 12 prochains mois');
    }
    if (dto.endDate && Date.parse(`${dto.endDate}T00:00:00Z`) < start) {
      throw new BadRequestException('La date de fin doit être postérieure à la date d’arrivée');
    }
    if (dto.provisionAt && Date.parse(dto.provisionAt) > start + 2 * DAY) {
      throw new BadRequestException('Les accès doivent être créés au plus tard le jour de l’arrivée');
    }
  }
}
