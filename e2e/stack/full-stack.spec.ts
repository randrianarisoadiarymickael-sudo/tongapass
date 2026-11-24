import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { env, gitea, keycloakAdmin, MAILPIT, mailpitMessages, mattermost } from './env';

const SHOTS = '../docs/screenshots';
mkdirSync(SHOTS, { recursive: true });

const suffix = Array.from({ length: 4 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
const firstName = 'Hanitra';
const lastName = `Rakotomalala${suffix}`;
const username = `hanitra.rakotomalala${suffix}`.slice(0, 22).replace(/[._-]+$/, '');

async function keycloakLogin(page: Page, user: string, screenshot?: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter avec Keycloak' }).click();
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(env.TP_DEMO_PASSWORD);
  if (screenshot) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${screenshot}` });
  }
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
}

const realmRoles = async (userId: string) =>
  ((await (await keycloakAdmin(`/users/${userId}/role-mappings/realm`)).json()) as { name: string }[]).map((r) => r.name);

test.describe.configure({ mode: 'serial' });

let kcUserId = '';
let employeeUrl = '';

test('recette : arrivée sur la pile réelle (Keycloak, n8n, Gitea, Mattermost, SMTP)', async ({ page }) => {
  await keycloakLogin(page, 'rh.manager', 'keycloak-login.png');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/dashboard.png` });

  await page.getByRole('link', { name: 'Déclarer une arrivée' }).first().click();
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByLabel('E-mail personnel').fill(`hanitra.${suffix}@example.org`);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Intitulé du poste').fill('Développeuse back-end');
  await page.getByLabel('Service').fill('Engineering');
  await page.getByLabel(/^Manager/).fill('Toky Andrianina');
  await page.getByLabel(/^E-mail du manager/).fill('toky.andrianina@tongapass.local');
  await page.getByText('Développement back-end', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Accès accordés' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/onboarding-review.png`, fullPage: true });
  const observer = await page.context().newPage();
  await observer.goto('/');
  await expect(observer.getByText('Synchronisé', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Créer les comptes' }).click();

  await expect(page).toHaveURL(/\/executions\//);
  await expect(page.getByText('Terminée', { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  await observer.getByRole('button', { name: /Activité en direct/ }).click();
  const activity = observer.getByRole('dialog', { name: 'Activité en direct' });
  const runPath = new URL(page.url()).pathname;
  await expect(activity.getByRole('link', { name: /Exécution en cours/ }).and(activity.locator(`a[href="${runPath}"]`))).toHaveCount(1);
  await expect(activity.getByRole('link', { name: /Étape Keycloak/ }).first()).toHaveAttribute('href', runPath);
  await expect(activity.getByRole('link', { name: /Exécution terminée/i }).first()).toHaveAttribute('href', runPath);
  await observer.screenshot({ path: `${SHOTS}/activite-en-direct.png` });
  await observer.close();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/onboarding-run.png`, fullPage: true });

  // Vérifications directes dans chaque système
  const users = (await (await keycloakAdmin(`/users?username=${username}&exact=true`)).json()) as {
    id: string;
    enabled: boolean;
    attributes?: Record<string, string[]>;
  }[];
  expect(users).toHaveLength(1);
  kcUserId = users[0].id;
  expect(users[0].enabled).toBe(true);
  expect(users[0].attributes?.employeeNumber?.[0]).toMatch(/^TP-\d{4}-\d{4}$/);
  const roles = await realmRoles(kcUserId);
  expect(roles).toEqual(expect.arrayContaining(['employee', 'developer']));
  expect(roles).not.toContain('devops');
  expect(roles.some((r) => r.startsWith('tp-'))).toBe(false); // aucune escalade de privilèges
  const groups = ((await (await keycloakAdmin(`/users/${kcUserId}/groups`)).json()) as { name: string }[]).map((g) => g.name);
  expect(groups).toContain('Engineering');

  expect((await gitea(`/users/${username}`)).status).toBe(200);
  const mmUser = (await (await mattermost(`/users/username/${username}`)).json()) as { id: string; delete_at: number };
  expect(mmUser.delete_at).toBe(0);

  await expect.poll(async () => (await mailpitMessages(`to:hanitra.${suffix}@example.org`)).length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await mailpitMessages(`to:${username}@tongapass.local`)).length, { timeout: 30_000 }).toBeGreaterThan(0);

  await page.getByRole('link', { name: `${firstName} ${lastName}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: `${firstName} ${lastName}` })).toBeVisible();
  employeeUrl = page.url();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/employee-active.png`, fullPage: true });

  const welcome = (await mailpitMessages(`to:hanitra.${suffix}@example.org`))[0];
  await page.goto(`${MAILPIT}/view/${welcome.ID}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/welcome-email.png` });
});

test('recette : mobilité vers DevOps, droits ajustés dans chaque outil', async ({ page }) => {
  await keycloakLogin(page, 'rh.manager');
  await page.goto(employeeUrl);
  await page.getByRole('button', { name: 'Changer de poste' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nouveau profil d’accès').selectOption({ label: 'Ingénierie DevOps' });
  await expect(dialog.getByText(/Développement back-end → Ingénierie DevOps/)).toBeVisible();
  await dialog.getByLabel('Intitulé de poste').fill('Ingénieure DevOps');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/mobility-dialog.png` });
  await dialog.getByRole('button', { name: 'Appliquer la mobilité' }).click();

  await page.getByRole('tab', { name: /Exécutions/ }).click();
  const latest = page.locator('#latest-run');
  await expect(latest.getByRole('heading', { name: /Mobilité/ })).toBeVisible();
  await expect(latest.getByText('Terminée', { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: `${SHOTS}/mobility-run.png`, fullPage: true });

  await expect.poll(() => realmRoles(kcUserId), { timeout: 15_000 }).toContain('devops');
  const teams = (await (await gitea('/orgs/tongapass/teams')).json()) as { id: number; name: string }[];
  const devops = teams.find((t) => t.name === 'devops')!;
  expect((await gitea(`/teams/${devops.id}/members/${username}`)).status).toBe(200);
});

test('recette : un droit ajouté hors TongaPass est détecté comme écart', async ({ page }) => {
  await keycloakLogin(page, 'admin.it');
  await page.goto(employeeUrl);
  await page.getByRole('button', { name: 'Vérifier' }).click();
  const accessPanel = page.getByRole('tabpanel', { name: 'Accès' });
  await expect(accessPanel.getByText('Droits conformes au profil')).toBeVisible();

  // Modification manuelle dans la console Keycloak, sans passer par le portail
  const finance = (await (await keycloakAdmin('/roles/finance')).json()) as { id: string; name: string };
  const added = await keycloakAdmin(`/users/${kcUserId}/role-mappings/realm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([finance]),
  });
  expect(added.status).toBe(204);

  try {
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(accessPanel.getByText('Écart détecté', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Conformité' }).click();
    await page.getByRole('button', { name: 'Lancer un contrôle' }).click();
    const row = page.getByRole('row', { name: new RegExp(`${firstName} ${lastName}`) });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText(/rôles en trop : finance/)).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/compliance.png`, fullPage: true });
  } finally {
    // Remise en état, même en cas d'échec, pour ne pas laisser de droit parasite
    await keycloakAdmin(`/users/${kcUserId}/role-mappings/realm`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([finance]),
    });
  }
});

test('recette : départ avec révocation complète', async ({ page }) => {
  await keycloakLogin(page, 'rh.manager');
  await page.goto(employeeUrl);
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Déclarer le départ…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Recopiez l’identifiant/).fill(username);
  await page.screenshot({ path: `${SHOTS}/offboarding-dialog.png` });
  await dialog.getByRole('button', { name: 'Révoquer les accès' }).click();

  const status = page.getByRole('heading', { level: 1 }).locator('xpath=..');
  await expect(status.getByText('Parti', { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/employee-departed.png`, fullPage: true });

  const after = (await (await keycloakAdmin(`/users/${kcUserId}`)).json()) as { enabled: boolean };
  expect(after.enabled).toBe(false);
  expect((await realmRoles(kcUserId)).filter((r) => !r.startsWith('default-roles'))).toEqual([]);
  const giteaAfter = (await (await gitea(`/users/${username}`)).json()) as { prohibit_login?: boolean; active?: boolean };
  expect(giteaAfter.prohibit_login ?? !giteaAfter.active).toBe(true);
  const mmUser = (await (await mattermost(`/users/username/${username}`)).json()) as { id: string; delete_at: number };
  expect(mmUser.delete_at).toBeGreaterThan(0);
  await expect.poll(async () => (await mailpitMessages(`subject:"Départ de ${firstName} ${lastName}"`)).length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test('recette : l’auditeur vérifie l’intégrité du journal', async ({ page }) => {
  await keycloakLogin(page, 'auditeur');
  await page.getByRole('link', { name: 'Journal d’audit' }).click();
  await page.getByRole('button', { name: 'Vérifier l’intégrité' }).click();
  await expect(page.getByText(/Chaîne intègre/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/audit.png`, fullPage: true });
  await page.getByRole('link', { name: 'Intégrations' }).click();
  await expect(page.getByText(/(\d+) sur \1 opérationnels/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/integrations.png` });
});

test('captures : workflows n8n', async ({ page }) => {
  await page.goto('http://localhost:5678/signin');
  await page.getByLabel(/Email/i).fill(env.N8N_OWNER_EMAIL);
  await page.getByLabel(/Password|Mot de passe/i).fill(env.N8N_OWNER_PASSWORD);
  await page.getByRole('button', { name: /Sign in|Se connecter/i }).click();
  await page.waitForURL(/home|workflows/, { timeout: 30_000 });
  for (const [id, name] of [
    ['tpOnboarding0001', 'n8n-onboarding'],
    ['tpMobility000001', 'n8n-mobility'],
  ] as const) {
    await page.goto(`http://localhost:5678/workflow/${id}`);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
});
