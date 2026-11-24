import Keycloak from 'keycloak-js';
import { config } from './config';
import { clearAllDrafts } from './draft';

/**
 * Client OIDC Keycloak : flux Authorization Code + PKCE (S256), jetons en mémoire uniquement
 * (jamais dans localStorage), rafraîchissement automatique avant expiration.
 */
export const keycloak = new Keycloak({
  url: config.keycloak.url,
  realm: config.keycloak.realm,
  clientId: config.keycloak.clientId,
});

let initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  initPromise ??= keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    // Vérification SSO par redirection (prompt=none) plutôt que par iframe : aucune dépendance
    // aux cookies tiers ni délai d'expiration de message, CSP stricte (frame-ancestors 'none').
    checkLoginIframe: false,
    responseMode: 'query',
    scope: 'openid profile email',
  });
  return initPromise;
}

/** Retourne un jeton d'accès valide au moins 30 s, en le rafraîchissant si besoin. */
export async function getAccessToken(): Promise<string | undefined> {
  if (!keycloak.authenticated) return undefined;
  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
    return undefined;
  }
  return keycloak.token;
}

export function login(redirectPath?: string): Promise<void> {
  return keycloak.login({
    redirectUri: redirectPath ? `${window.location.origin}${redirectPath}` : window.location.href,
    locale: 'fr',
  });
}

export function logout(): Promise<void> {
  clearAllDrafts();
  return keycloak.logout({ redirectUri: window.location.origin });
}
