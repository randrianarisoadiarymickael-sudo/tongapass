import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

export interface DirectoryUser {
  id: string;
  username: string;
  enabled: boolean;
  realmRoles: string[];
  groups: string[];
}

export class DirectoryUnavailableError extends Error {}

/**
 * Lecture seule de l'annuaire Keycloak via le compte de service « tongapass-auditor »
 * (view-users, query-groups : aucun droit d'écriture). Sert au contrôle de conformité.
 */
@Injectable()
export class KeycloakDirectoryClient {
  private readonly logger = new Logger(KeycloakDirectoryClient.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get enabled(): boolean {
    return !!this.config.get('keycloak', { infer: true }).auditorSecret;
  }

  private get base(): string {
    const keycloak = this.config.get('keycloak', { infer: true });
    return `${keycloak.internalUrl}/admin/realms/${keycloak.realm}`;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 15_000) return this.token.value;
    const keycloak = this.config.get('keycloak', { infer: true });
    if (!keycloak.auditorSecret) throw new DirectoryUnavailableError('Contrôle désactivé : KEYCLOAK_AUDITOR_SECRET absent');
    let response: Response;
    try {
      response = await fetch(`${keycloak.internalUrl}/realms/${keycloak.realm}/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: keycloak.auditorClientId,
          client_secret: keycloak.auditorSecret,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new DirectoryUnavailableError(`Keycloak injoignable (${(error as Error).message})`);
    }
    if (!response.ok) throw new DirectoryUnavailableError(`Authentification du compte d'audit refusée (HTTP ${response.status})`);
    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  private async get<T>(path: string): Promise<{ status: number; body: T | null }> {
    const token = await this.accessToken();
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new DirectoryUnavailableError(`Keycloak injoignable (${(error as Error).message})`);
    }
    if (response.status === 401) this.token = null;
    if (response.status >= 500 || response.status === 401 || response.status === 403) {
      throw new DirectoryUnavailableError(`Lecture de l'annuaire refusée (HTTP ${response.status})`);
    }
    return { status: response.status, body: response.ok ? ((await response.json()) as T) : null };
  }

  /** Recherche le compte par identifiant Keycloak, sinon par nom d'utilisateur exact. */
  async findUser(keycloakUserId: string | null, username: string): Promise<DirectoryUser | null> {
    type Raw = { id: string; username: string; enabled: boolean };
    let user: Raw | null = null;
    if (keycloakUserId) {
      const byId = await this.get<Raw>(`/users/${encodeURIComponent(keycloakUserId)}`);
      if (byId.status === 200) user = byId.body;
    }
    if (!user) {
      const found = await this.get<Raw[]>(`/users?username=${encodeURIComponent(username)}&exact=true`);
      user = found.body?.[0] ?? null;
    }
    if (!user) return null;
    const roles = await this.get<{ name: string }[]>(`/users/${user.id}/role-mappings/realm`);
    const groups = await this.get<{ name: string }[]>(`/users/${user.id}/groups`);
    return {
      id: user.id,
      username: user.username,
      enabled: user.enabled,
      realmRoles: (roles.body ?? []).map((role) => role.name).filter((name) => !name.startsWith('default-roles-')),
      groups: (groups.body ?? []).map((group) => group.name),
    };
  }
}
