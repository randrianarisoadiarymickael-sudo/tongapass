import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours utilisateur de bout en bout : vrai portail (Vite), vraie API NestJS, vraie base PostgreSQL.
 * Keycloak et n8n sont remplacés par des doublures de protocole (tools/dev-stubs) afin que la suite
 * tourne en quelques minutes en CI ; l'intégration réelle est couverte par docker compose.
 */
const CI = !!process.env.CI;
const HMAC = process.env.AUTOMATION_HMAC_SECRET ?? 'local-e2e-hmac-secret-0123456789abcdef0123';
const WEBHOOK = process.env.N8N_WEBHOOK_TOKEN ?? 'local-e2e-webhook-token-0123456789';
const channel = process.env.E2E_BROWSER_CHANNEL ?? (CI ? 'chromium' : 'msedge');

const apiEnv = {
  NODE_ENV: 'production',
  PORT: '4100',
  LOG_LEVEL: 'warn',
  DATABASE_HOST: process.env.DATABASE_HOST ?? 'localhost',
  DATABASE_PORT: process.env.DATABASE_PORT ?? '5434',
  DATABASE_USER: process.env.DATABASE_USER ?? 'tongapass',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? '',
  DATABASE_NAME: process.env.DATABASE_NAME ?? 'tongapass',
  KEYCLOAK_ISSUER: 'http://localhost:8180/realms/tongapass',
  KEYCLOAK_JWKS_URI: 'http://localhost:8180/realms/tongapass/protocol/openid-connect/certs',
  KEYCLOAK_INTERNAL_URL: 'http://localhost:8180',
  N8N_BASE_URL: 'http://localhost:5678',
  N8N_WEBHOOK_TOKEN: WEBHOOK,
  AUTOMATION_HMAC_SECRET: HMAC,
  AUTOMATION_CALLBACK_URL: 'http://localhost:4100/api/v1/automation/events',
  CORS_ORIGINS: 'http://localhost:5173',
  PORTAL_URL: 'http://localhost:5173',
  THROTTLE_LIMIT: '5000',
};

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'fr-FR',
    timezoneId: 'Indian/Antananarivo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: channel,
      use: { ...devices['Desktop Chrome'], channel: channel === 'chromium' ? undefined : channel },
    },
  ],
  webServer: [
    {
      command: 'node ../tools/dev-stubs/fake-oidc.mjs',
      url: 'http://localhost:8180/realms/tongapass/.well-known/openid-configuration',
      reuseExistingServer: !CI,
    },
    {
      command: 'node ../tools/dev-stubs/n8n-simulator.mjs',
      url: 'http://localhost:5678/healthz',
      reuseExistingServer: !CI,
      env: { N8N_WEBHOOK_TOKEN: WEBHOOK, AUTOMATION_HMAC_SECRET: HMAC, SIM_DELAY_MS: '500' },
    },
    {
      command: 'npm --prefix ../apps/api run build && node ../apps/api/dist/database/run-migrations.js && node ../apps/api/dist/main.js',
      url: 'http://localhost:4100/api/v1/health',
      reuseExistingServer: !CI,
      timeout: 180_000,
      env: apiEnv,
    },
    {
      command: 'npm --prefix ../apps/portal run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_KEYCLOAK_URL: 'http://localhost:8180' },
    },
  ],
});
