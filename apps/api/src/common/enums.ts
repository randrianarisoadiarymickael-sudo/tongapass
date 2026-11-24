/** Rôles applicatifs (rôles de royaume Keycloak) donnant accès au portail TongaPass. */
export enum AppRole {
  ADMIN = 'tp-admin',
  HR = 'tp-hr',
  AUDITOR = 'tp-auditor',
}

export const APP_ROLES: readonly AppRole[] = Object.values(AppRole);

export enum EmployeeStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  OFFBOARDING_SCHEDULED = 'OFFBOARDING_SCHEDULED',
  OFFBOARDING = 'OFFBOARDING',
  DEPARTED = 'DEPARTED',
  FAILED = 'FAILED',
  /** Arrivée annulée avant la création des comptes. */
  CANCELLED = 'CANCELLED',
}

export enum ContractType {
  CDI = 'CDI',
  CDD = 'CDD',
  INTERNSHIP = 'STAGE',
  CONTRACTOR = 'PRESTATAIRE',
}

export enum RunType {
  ONBOARDING = 'ONBOARDING',
  /** Mobilité interne : changement de poste ou de profil d'accès. */
  MOBILITY = 'MOBILITY',
  OFFBOARDING = 'OFFBOARDING',
}

export enum RunStatus {
  SCHEDULED = 'SCHEDULED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = [RunStatus.QUEUED, RunStatus.RUNNING];
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  RunStatus.SUCCEEDED,
  RunStatus.PARTIAL,
  RunStatus.FAILED,
  RunStatus.CANCELLED,
  RunStatus.TIMED_OUT,
];

export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export const TERMINAL_STEP_STATUSES: readonly StepStatus[] = [
  StepStatus.SUCCEEDED,
  StepStatus.FAILED,
  StepStatus.SKIPPED,
];

export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  DRIFT = 'DRIFT',
  NO_ACCOUNT = 'NO_ACCOUNT',
  UNREACHABLE = 'UNREACHABLE',
}

export enum ActorType {
  USER = 'USER',
  AUTOMATION = 'AUTOMATION',
  SYSTEM = 'SYSTEM',
}
