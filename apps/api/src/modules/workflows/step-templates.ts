import { RunType } from '../../common/enums';
import { StepSystem } from './workflow-step.entity';

export interface StepTemplate {
  key: string;
  label: string;
  system: StepSystem;
  /** Une étape critique en échec fait échouer toute l'exécution. */
  critical: boolean;
}

/**
 * Étapes attendues pour chaque type d'exécution. Les clés correspondent exactement
 * aux callbacks envoyés par les workflows n8n (automation/n8n/workflows).
 */
export const STEP_TEMPLATES: Record<RunType, StepTemplate[]> = {
  [RunType.ONBOARDING]: [
    { key: 'keycloak.account', label: 'Compte Keycloak créé', system: 'keycloak', critical: true },
    { key: 'keycloak.roles', label: 'Rôles et groupes attribués', system: 'keycloak', critical: false },
    { key: 'keycloak.activation', label: 'Lien d’activation envoyé', system: 'keycloak', critical: false },
    { key: 'gitea.account', label: 'Compte Gitea et équipes', system: 'gitea', critical: false },
    { key: 'chat.invite', label: 'Invitation Mattermost', system: 'chat', critical: false },
    { key: 'email.welcome', label: 'E-mail de bienvenue', system: 'email', critical: false },
  ],
  [RunType.MOBILITY]: [
    { key: 'keycloak.sync', label: 'Rôles et groupes Keycloak ajustés', system: 'keycloak', critical: true },
    { key: 'gitea.sync', label: 'Équipes Gitea ajustées', system: 'gitea', critical: false },
    { key: 'chat.sync', label: 'Canaux Mattermost ajustés', system: 'chat', critical: false },
    { key: 'email.notify', label: 'Collaborateur et manager informés', system: 'email', critical: false },
  ],
  [RunType.OFFBOARDING]: [
    { key: 'keycloak.disable', label: 'Compte Keycloak désactivé', system: 'keycloak', critical: true },
    { key: 'keycloak.sessions', label: 'Sessions actives révoquées', system: 'keycloak', critical: true },
    { key: 'keycloak.roles', label: 'Rôles et groupes retirés', system: 'keycloak', critical: false },
    { key: 'gitea.revoke', label: 'Accès Gitea bloqué', system: 'gitea', critical: false },
    { key: 'chat.deactivate', label: 'Compte Mattermost désactivé', system: 'chat', critical: false },
    { key: 'email.notify', label: 'Récapitulatif envoyé au manager', system: 'email', critical: false },
  ],
};
