// Contrat TypeScript de l'API TongaPass (voir Swagger : /api/docs)

export type AppRole = 'tp-admin' | 'tp-hr' | 'tp-auditor';

export type EmployeeStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'OFFBOARDING_SCHEDULED'
  | 'OFFBOARDING'
  | 'DEPARTED'
  | 'FAILED'
  | 'CANCELLED';

export type RunType = 'ONBOARDING' | 'MOBILITY' | 'OFFBOARDING';
export type ComplianceStatus = 'COMPLIANT' | 'DRIFT' | 'NO_ACCOUNT' | 'UNREACHABLE';
export type RunStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';
export type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
export type StepSystem = 'keycloak' | 'gitea' | 'chat' | 'email' | 'core';
export type ContractType = 'CDI' | 'CDD' | 'STAGE' | 'PRESTATAIRE';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Me {
  sub: string;
  username: string;
  name?: string;
  email?: string;
  roles: AppRole[];
  permissions: {
    manageEmployees: boolean;
    manageProfiles: boolean;
    viewAudit: boolean;
    viewIntegrations: boolean;
  };
  workspace: {
    company: string;
    emailDomain: string;
    links: Record<'n8n' | 'keycloak' | 'gitea' | 'mattermost' | 'mailpit' | 'apiDocs', string | null>;
  };
}

export interface AccessProfile {
  id: string;
  code: string;
  name: string;
  description: string;
  color: string;
  realmRoles: string[];
  groups: string[];
  giteaTeams: string[];
  chatChannels: string[];
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItem {
  value: string;
  label: string;
  description: string;
  sensitive?: boolean;
}

export type AccessCatalog = Record<'realmRoles' | 'groups' | 'giteaTeams' | 'chatChannels', CatalogItem[]>;

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  personalEmail: string;
  workEmail: string;
  username: string;
  jobTitle: string;
  department: string;
  location: string | null;
  contractType: ContractType;
  managerName: string | null;
  managerEmail: string | null;
  startDate: string;
  endDate: string | null;
  status: EmployeeStatus;
  accessProfileId: string;
  accessProfile: AccessProfile;
  extraRealmRoles: string[];
  extraAccessJustification: string | null;
  keycloakUserId: string | null;
  giteaUsername: string | null;
  chatUserId: string | null;
  createdBy: string;
  departedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  key: string;
  label: string;
  system: StepSystem;
  position: number;
  critical: boolean;
  status: StepStatus;
  detail: string | null;
  meta: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunSummary {
  id: string;
  type: RunType;
  status: RunStatus;
  attempt: number;
  triggeredBy: string;
  reason: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  error: string | null;
  n8nExecutionId: string | null;
  progress: { done: number; total: number };
  failedSteps: number;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'username' | 'jobTitle' | 'department' | 'status'>;
}

export interface RunDetail extends RunSummary {
  steps: WorkflowStep[];
  options?: Record<string, unknown> | null;
}

export interface EmployeeDetail extends Employee {
  effectiveAccess: {
    realmRoles: string[];
    extraRealmRoles: string[];
    groups: string[];
    giteaTeams: string[];
    chatChannels: string[];
    accounts: Record<'keycloak' | 'gitea' | 'chat', { id: string; active: boolean } | null>;
  };
  runs: RunDetail[];
}

export interface OnboardingPreview {
  identity: { username: string; workEmail: string };
  profile: Pick<AccessProfile, 'id' | 'code' | 'name' | 'color'>;
  access: {
    realmRoles: string[];
    extraRealmRoles: string[];
    groups: string[];
    giteaTeams: string[];
    chatChannels: string[];
  };
  sensitiveAccess: string[];
  steps: { key: string; label: string; system: StepSystem; critical: boolean }[];
}

export interface AgendaItem {
  kind: 'ARRIVAL' | 'MOBILITY' | 'DEPARTURE';
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

export interface ComplianceSummary {
  enabled: boolean;
  total: number;
  counts: Record<ComplianceStatus, number>;
  lastCheckAt: string | null;
}

export interface DashboardSummary {
  generatedAt: string;
  kpis: {
    activeEmployees: number;
    runsInProgress: number;
    scheduledArrivals: number;
    scheduledDepartures: number;
    mobilitiesThisMonth: number;
    revokedThisMonth: number;
    avgProvisioningSeconds: number | null;
    needsAttention: number;
  };
  agenda: AgendaItem[];
  monthly: { month: string; arrivals: number; departures: number }[];
  recentRuns: RunSummary[];
  contractsEnding: { employeeId: string; name: string; contractType: ContractType; endDate: string }[];
  compliance: ComplianceSummary;
}

export interface AccessSet {
  realmRoles: string[];
  groups: string[];
  giteaTeams: string[];
  chatChannels: string[];
}

export interface MobilityPreview {
  from: { id: string; name: string; color: string };
  to: { id: string; name: string; color: string };
  added: AccessSet;
  removed: AccessSet;
  kept: AccessSet;
  changed: boolean;
  extraRealmRoles: string[];
  sensitiveAdded: string[];
}

export interface ComplianceDetails {
  expected: { enabled: boolean; realmRoles: string[]; groups: string[] };
  actual: { exists: boolean; enabled: boolean | null; realmRoles: string[]; groups: string[] } | null;
  missingRoles: string[];
  unexpectedRoles: string[];
  missingGroups: string[];
  unexpectedGroups: string[];
  enabledMismatch: boolean;
  message: string;
}

export interface ComplianceCheck {
  id: string;
  employeeId?: string;
  status: ComplianceStatus;
  checkedAt: string;
  triggeredBy: string;
  details: ComplianceDetails;
}

export interface ComplianceOverview {
  summary: ComplianceSummary;
  items: (ComplianceCheck & {
    employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'username' | 'status'> & { profile: { name: string; color: string } };
  })[];
}

export interface AuditLog {
  id: string;
  occurredAt: string;
  actorType: 'USER' | 'AUTOMATION' | 'SYSTEM';
  actorId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  prevHash: string;
  hash: string;
}

export interface IntegrityReport {
  valid: boolean;
  checked: number;
  brokenAtId: string | null;
  lastHash: string | null;
  verifiedAt: string;
}

export interface IntegrationStatus {
  key: string;
  name: string;
  role: string;
  state: 'up' | 'down' | 'disabled';
  latencyMs: number | null;
  version: string | null;
  link: string | null;
  checkedAt: string;
  error?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: { field: string; messages: string[] }[];
  requestId?: string;
}
