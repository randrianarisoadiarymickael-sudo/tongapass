import type { ComplianceStatus, ContractType, EmployeeStatus, RunStatus, RunType, StepStatus, StepSystem } from './types';

export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'info' | 'warning';

export const EMPLOYEE_STATUS: Record<EmployeeStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Arrivée planifiée', tone: 'warning' },
  PROVISIONING: { label: 'Provisionnement', tone: 'info' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  OFFBOARDING_SCHEDULED: { label: 'Départ planifié', tone: 'warning' },
  OFFBOARDING: { label: 'Révocation en cours', tone: 'danger' },
  DEPARTED: { label: 'Parti', tone: 'neutral' },
  FAILED: { label: 'À corriger', tone: 'danger' },
  CANCELLED: { label: 'Arrivée annulée', tone: 'neutral' },
};

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Planifiée', tone: 'warning' },
  QUEUED: { label: 'En file', tone: 'info' },
  RUNNING: { label: 'En cours', tone: 'info' },
  SUCCEEDED: { label: 'Terminée', tone: 'success' },
  PARTIAL: { label: 'Partielle', tone: 'warning' },
  FAILED: { label: 'Échec', tone: 'danger' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  TIMED_OUT: { label: 'Expirée', tone: 'danger' },
};

export const STEP_STATUS: Record<StepStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En attente', tone: 'neutral' },
  RUNNING: { label: 'En cours', tone: 'info' },
  SUCCEEDED: { label: 'Fait', tone: 'success' },
  FAILED: { label: 'Échec', tone: 'danger' },
  SKIPPED: { label: 'Non concernée', tone: 'neutral' },
};

export const RUN_TYPE: Record<RunType, string> = {
  ONBOARDING: 'Arrivée',
  MOBILITY: 'Mobilité',
  OFFBOARDING: 'Départ',
};

export const COMPLIANCE_STATUS: Record<ComplianceStatus, { label: string; tone: Tone }> = {
  COMPLIANT: { label: 'Conforme', tone: 'success' },
  DRIFT: { label: 'Écart détecté', tone: 'danger' },
  NO_ACCOUNT: { label: 'Compte manquant', tone: 'warning' },
  UNREACHABLE: { label: 'Non vérifiable', tone: 'neutral' },
};

export const SYSTEM_LABEL: Record<StepSystem, string> = {
  keycloak: 'Keycloak',
  gitea: 'Gitea',
  chat: 'Mattermost',
  email: 'E-mail',
  core: 'TongaPass',
};

export const CONTRACT_LABEL: Record<ContractType, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'Stage',
  PRESTATAIRE: 'Prestataire',
};

export const DEPARTURE_REASONS = [
  { value: 'RESIGNATION', label: 'Démission' },
  { value: 'END_OF_CONTRACT', label: 'Fin de contrat' },
  { value: 'END_OF_INTERNSHIP', label: 'Fin de stage' },
  { value: 'DISMISSAL', label: 'Licenciement' },
  { value: 'RETIREMENT', label: 'Départ à la retraite' },
  { value: 'MOBILITY', label: 'Mobilité externe' },
  { value: 'OTHER', label: 'Autre motif' },
] as const;

export const ROLE_LABEL: Record<string, string> = {
  'tp-admin': 'Administration IAM',
  'tp-hr': 'Ressources humaines',
  'tp-auditor': 'Audit',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'onboarding.requested': 'Arrivée déclarée',
  'onboarding.scheduled': 'Arrivée planifiée',
  'onboarding.cancelled': 'Arrivée annulée',
  'onboarding.advanced': 'Arrivée avancée',
  'onboarding.dispatched': 'Workflow d’arrivée lancé',
  'onboarding.completed': 'Arrivée terminée',
  'onboarding.partial': 'Arrivée partielle',
  'onboarding.failed': 'Arrivée en échec',
  'onboarding.timed_out': 'Arrivée expirée',
  'mobility.requested': 'Mobilité demandée',
  'mobility.scheduled': 'Mobilité planifiée',
  'mobility.cancelled': 'Mobilité annulée',
  'mobility.advanced': 'Mobilité avancée',
  'mobility.dispatched': 'Workflow de mobilité lancé',
  'mobility.completed': 'Mobilité terminée',
  'mobility.partial': 'Mobilité partielle',
  'mobility.failed': 'Mobilité en échec',
  'mobility.timed_out': 'Mobilité expirée',
  'offboarding.requested': 'Départ déclaré',
  'offboarding.scheduled': 'Départ planifié',
  'offboarding.cancelled': 'Départ annulé',
  'offboarding.advanced': 'Départ avancé',
  'offboarding.dispatched': 'Workflow de départ lancé',
  'offboarding.completed': 'Départ terminé',
  'offboarding.partial': 'Départ partiel',
  'offboarding.failed': 'Départ en échec',
  'offboarding.timed_out': 'Départ expiré',
  'access.granted': 'Accès accordé',
  'access.revoked': 'Accès révoqué',
  'automation.step_failed': 'Étape en échec',
  'automation.dispatch_failed': 'Déclenchement impossible',
  'employee.updated': 'Fiche modifiée',
  'employees.exported': 'Annuaire exporté',
  'profile.created': 'Profil créé',
  'profile.updated': 'Profil modifié',
  'profile.deleted': 'Profil supprimé',
  'run.retried': 'Exécution relancée',
  'compliance.checked': 'Conformité vérifiée',
  'compliance.drift': 'Écart de droits',
  'compliance.scanned': 'Contrôle global',
  'audit.verified': 'Intégrité vérifiée',
  'audit.exported': 'Journal exporté',
};

/** Pastilles de statut : fond teinté, texte de la couleur d'état, liseré fin. */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-hover text-ink-2 ring-line-strong',
  brand: 'bg-brand-soft text-brand ring-brand/25',
  success: 'bg-success-soft text-success ring-success/25',
  danger: 'bg-danger-soft text-danger ring-danger/25',
  info: 'bg-info-soft text-info ring-info/25',
  warning: 'bg-warning-soft text-warning ring-warning/25',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-3',
  brand: 'text-brand',
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  brand: 'bg-brand',
  success: 'bg-success',
  danger: 'bg-danger',
  info: 'bg-info',
  warning: 'bg-warning',
};
