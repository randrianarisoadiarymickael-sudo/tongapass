import { ActorType, AppRole } from './enums';

/** Utilisateur authentifié, extrait d'un jeton Keycloak vérifié. */
export interface AuthenticatedUser {
  sub: string;
  username: string;
  name?: string;
  email?: string;
  roles: AppRole[];
}

/** Contexte d'un acteur pour le journal d'audit. */
export interface ActorContext {
  type: ActorType;
  id: string;
  name: string;
  ip?: string | null;
  userAgent?: string | null;
}

export const SYSTEM_ACTOR: ActorContext = {
  type: ActorType.SYSTEM,
  id: 'system',
  name: 'TongaPass (planificateur)',
};

export const AUTOMATION_ACTOR: ActorContext = {
  type: ActorType.AUTOMATION,
  id: 'n8n',
  name: 'n8n (automatisation)',
};
