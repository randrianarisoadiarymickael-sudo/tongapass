import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Lit le .env du dépôt (généré par scripts/init-env.mjs) sans dépendance externe. */
export function loadEnv(): Record<string, string> {
  const path = resolve(import.meta.dirname, '../../.env');
  if (!existsSync(path)) throw new Error('.env introuvable : lancez node scripts/init-env.mjs');
  const entries = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^"(.*)"$/, '$1')] as const;
    });
  return { ...Object.fromEntries(entries), ...(process.env as Record<string, string>) };
}

export const env = loadEnv();

export const KEYCLOAK = 'http://localhost:8180';
export const GITEA = 'http://localhost:3300';
export const MATTERMOST = 'http://localhost:8065';
export const MAILPIT = 'http://localhost:8025';

export async function keycloakAdmin(path: string, init: RequestInit = {}) {
  const token = await fetch(`${KEYCLOAK}/realms/tongapass/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'tongapass-provisioner',
      client_secret: env.TP_PROVISIONER_SECRET,
    }),
  }).then((r) => r.json() as Promise<{ access_token: string }>);
  return fetch(`${KEYCLOAK}/admin/realms/tongapass${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.access_token}`, ...(init.headers ?? {}) },
  });
}

export const gitea = (path: string) =>
  fetch(`${GITEA}/api/v1${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${env.GITEA_ADMIN_USER}:${env.GITEA_ADMIN_PASSWORD}`).toString('base64')}` },
  });

export async function mattermost(path: string) {
  const login = await fetch(`${MATTERMOST}/api/v4/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: env.MATTERMOST_ADMIN_USER, password: env.MATTERMOST_ADMIN_PASSWORD }),
  });
  return fetch(`${MATTERMOST}/api/v4${path}`, { headers: { Authorization: `Bearer ${login.headers.get('token')}` } });
}

export async function mailpitMessages(query: string): Promise<{ Subject: string; To: { Address: string }[]; ID: string }[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
  const body = (await res.json()) as { messages: { Subject: string; To: { Address: string }[]; ID: string }[] };
  return body.messages ?? [];
}
