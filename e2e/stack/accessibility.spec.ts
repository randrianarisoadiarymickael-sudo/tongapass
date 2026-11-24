import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { env } from './env';
import { fillPlannedArrival } from '../tests/helpers';

const SHOTS = '../docs/screenshots';
mkdirSync(SHOTS, { recursive: true });

// Pas de trace pour cet audit : le portail reçoit des événements en continu (flux SSE)
// et la trace enregistrait chaque mutation pendant les analyses axe, ce qui faisait passer une page
// de 1 s à plus d'une minute et dépasser le délai du test. La liste des violations suffit au diagnostic.
test.use({ trace: 'off' });

const PAGES = [
  { path: '/', name: 'tableau-de-bord', heading: 'Vue d’ensemble' },
  { path: '/employes', name: 'annuaire', heading: 'Annuaire' },
  { path: '/arrivees/nouvelle', name: 'nouvelle-arrivee', heading: 'Déclarer une arrivée' },
  { path: '/executions', name: 'executions', heading: 'Exécutions' },
  { path: '/profils', name: 'profils', heading: 'Profils d’accès' },
  { path: '/conformite', name: 'conformite', heading: 'Conformité des droits' },
  { path: '/audit', name: 'audit-journal', heading: 'Journal d’audit' },
  { path: '/integrations', name: 'integrations-etat', heading: 'Intégrations' },
];

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter avec Keycloak' }).click();
  await page.locator('#username').fill('admin.it');
  await page.locator('#password').fill(env.TP_DEMO_PASSWORD);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('[data-sonner-toaster]');

test('accueil (build de production, CSP active) : aucune violation grave', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const results = await axe(page).analyze();
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/accueil.png` });
  const demo = page.getByRole('figure', { name: 'Exemple de fiche d’accès' });
  await demo.scrollIntoViewIfNeeded();
  await expect(demo.getByText('Accès ouverts')).toBeVisible();
  await expect(demo.getByText('En cours…')).toBeVisible();
  await expect(demo.getByText('Accès ouverts')).toBeVisible();
  await expect(page.getByRole('button', { name: /Rejouer/ })).toHaveCount(0);
  const pause = page.getByRole('button', { name: 'Mettre les animations en pause' });
  await pause.focus();
  await pause.press('Enter');
  await expect(page.locator('.hero-image')).toHaveCSS('animation-play-state', 'paused');
  await demo.getByRole('tab', { name: 'Départ' }).click();
  const counter = demo.getByText('0/3', { exact: true });
  await expect(counter).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(counter).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre les animations' }).click();
  await demo.scrollIntoViewIfNeeded();
  await expect(demo.getByText('Accès révoqués')).toBeVisible();
  const packet = page.locator('.flow-packet[data-edge="rh-api"]');
  await page.locator('.architecture-map').scrollIntoViewIfNeeded();
  const iteration = () => packet.evaluate((path) => Number(path.getAnimations()[0]?.effect?.getComputedTiming().currentIteration ?? 0));
  await expect.poll(iteration, { timeout: 15_000 }).toBeGreaterThan(await iteration());
  await page.setViewportSize({ width: 320, height: 740 });
  const firstStep = page.locator('.flow-list li').first();
  await firstStep.scrollIntoViewIfNeeded();
  await expect.poll(() => firstStep.evaluate((step) => getComputedStyle(step, '::before').animationPlayState)).toBe('running');
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await expect.poll(() => firstStep.evaluate((step) => getComputedStyle(step, '::before').animationPlayState)).toBe('paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fiche mobile au clavier et connexion depuis un lien vers une arrivée', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/arrivees/nouvelle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/accueil-mobile.png` });
  const example = page.getByRole('figure', { name: 'Exemple de fiche d’accès' });
  await example.getByRole('tab', { name: 'Arrivée' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(example.getByText('Canal ~incidents')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  const departure = example.getByRole('tabpanel', { name: 'Départ' });
  await expect(departure.getByText('Accès révoqués')).toBeVisible();
  await expect(departure).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Se connecter avec Keycloak' }).click();
  await page.locator('#username').fill('rh.manager');
  await page.locator('#password').fill(env.TP_DEMO_PASSWORD);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('heading', { name: 'Déclarer une arrivée' })).toBeVisible();

  await fillPlannedArrival(page, 'Soa', 'Rakoto');
  await page.getByRole('radio', { name: 'Autre date' }).click();
  await page.getByRole('button', { name: 'Planifier l’arrivée' }).click();
  await expect(page.getByText('Choisissez la date et l’heure de création des comptes')).toBeVisible();
  await page.getByLabel('Date et heure').fill('2020-01-01T08:00');
  await page.getByRole('button', { name: 'Planifier l’arrivée' }).click();
  await expect(page.getByText(/Choisissez une heure à plus d’une minute/)).toBeVisible();
  await page.getByRole('radio', { name: 'La veille de l’arrivée' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByLabel('Date d’arrivée').fill('');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Choisissez la date d’arrivée')).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Vue d’ensemble', exact: true }).click();
  await page.getByRole('link', { name: /Arrivées planifiées/ }).click();
  await expect(page.getByRole('radio', { name: 'Arrivées', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Statut' })).toHaveValue('SCHEDULED');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Agenda des mouvements' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`portail en thème ${theme === 'light' ? 'clair' : 'sombre'} : WCAG 2.2 AA`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('tp-theme', value), theme);
    await login(page);
    const problems: string[] = [];
    for (const target of PAGES) {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
      // Pas de « networkidle » : le flux SSE temps réel garde une connexion ouverte en permanence
      await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 20_000 });
      await page.waitForTimeout(target.path === '/' ? 1200 : 500);
      const results = await axe(page).analyze();
      for (const v of results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))) {
        problems.push(`${target.path} ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      }
      await page.screenshot({ path: `${SHOTS}/${target.name}-${theme}.png`, fullPage: true });
    }
    expect(problems).toEqual([]);
  });
}
