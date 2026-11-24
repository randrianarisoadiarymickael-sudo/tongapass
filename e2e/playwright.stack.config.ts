import { defineConfig, devices } from '@playwright/test';

/**
 * Recette sur la pile Docker complète (docker compose up) : vrai Keycloak, vrai n8n, vrais Gitea,
 * Mattermost et Mailpit. Les secrets sont lus dans le .env du dépôt (jamais en dur).
 * Usage : npm run test:stack
 */
export default defineConfig({
  testDir: './stack',
  timeout: 360_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-stack' }]],
  use: {
    baseURL: process.env.PORTAL_URL ?? 'http://localhost:8088',
    locale: 'fr-FR',
    timezoneId: 'Indian/Antananarivo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: process.env.E2E_BROWSER_CHANNEL ?? 'msedge',
      use: { ...devices['Desktop Chrome'], channel: (process.env.E2E_BROWSER_CHANNEL ?? 'msedge') === 'chromium' ? undefined : process.env.E2E_BROWSER_CHANNEL ?? 'msedge' },
    },
  ],
});
