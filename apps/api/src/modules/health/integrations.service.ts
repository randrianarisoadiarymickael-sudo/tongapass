import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

export type IntegrationState = 'up' | 'down' | 'disabled';

export interface IntegrationStatus {
  key: string;
  name: string;
  role: string;
  state: IntegrationState;
  latencyMs: number | null;
  version: string | null;
  link: string | null;
  checkedAt: string;
  error?: string;
}

interface Probe {
  key: string;
  name: string;
  role: string;
  url: string;
  link: string;
  version?: (body: unknown) => string | null;
}

/** Sonde chaque service tiers piloté par l'automatisation. */
@Injectable()
export class IntegrationsService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async check(): Promise<IntegrationStatus[]> {
    const keycloak = this.config.get('keycloak', { infer: true });
    const automation = this.config.get('automation', { infer: true });
    const integrations = this.config.get('integrations', { infer: true });
    const links = this.config.get('publicLinks', { infer: true });

    const probes: Probe[] = [
      {
        key: 'keycloak',
        name: 'Keycloak',
        role: 'Identités, rôles et sessions (IAM)',
        url: `${keycloak.internalUrl}/realms/${keycloak.realm}/.well-known/openid-configuration`,
        link: links.keycloak ? `${links.keycloak}/admin/master/console/#/${keycloak.realm}` : '',
      },
      {
        key: 'n8n',
        name: 'n8n',
        role: 'Moteur d’automatisation des workflows',
        url: `${automation.n8nBaseUrl}/healthz`,
        link: links.n8n,
      },
      {
        key: 'gitea',
        name: 'Gitea',
        role: 'Forge Git : comptes et équipes',
        // /api/healthz est public (l'API de version exige une connexion : REQUIRE_SIGNIN_VIEW)
        url: integrations.giteaUrl ? `${integrations.giteaUrl}/api/healthz` : '',
        link: links.gitea,
      },
      {
        key: 'mattermost',
        name: 'Mattermost',
        role: 'Messagerie d’équipe : invitations et annonces',
        url: integrations.mattermostUrl ? `${integrations.mattermostUrl}/api/v4/system/ping` : '',
        link: links.mattermost,
      },
      {
        key: 'smtp',
        name: 'SMTP (Mailpit)',
        role: 'Envoi des e-mails de bienvenue et d’activation',
        url: integrations.mailpitUrl ? `${integrations.mailpitUrl}/readyz` : '',
        link: links.mailpit,
      },
    ];

    return Promise.all(probes.map((probe) => this.run(probe)));
  }

  private async run(probe: Probe): Promise<IntegrationStatus> {
    const base = {
      key: probe.key,
      name: probe.name,
      role: probe.role,
      link: probe.link || null,
      checkedAt: new Date().toISOString(),
    };
    if (!probe.url) return { ...base, state: 'disabled', latencyMs: null, version: null };
    const started = performance.now();
    try {
      const response = await fetch(probe.url, { signal: AbortSignal.timeout(4000) });
      const latencyMs = Math.round(performance.now() - started);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        return { ...base, state: 'down', latencyMs, version: null, error: `HTTP ${response.status}` };
      }
      return { ...base, state: 'up', latencyMs, version: probe.version?.(body) ?? null };
    } catch (error) {
      return {
        ...base,
        state: 'down',
        latencyMs: null,
        version: null,
        error: (error as Error).name === 'TimeoutError' ? 'Délai dépassé' : (error as Error).message,
      };
    }
  }
}
