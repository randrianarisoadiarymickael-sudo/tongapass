import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login } from './helpers';

const PAGES = [
  { path: '/', name: 'tableau-de-bord', heading: 'Vue d’ensemble' },
  { path: '/employes', name: 'annuaire', heading: 'Annuaire' },
  { path: '/arrivees/nouvelle', name: 'nouvelle-arrivee', heading: 'Déclarer une arrivée' },
  { path: '/executions', name: 'executions', heading: 'Exécutions' },
  { path: '/profils', name: 'profils', heading: 'Profils d’accès' },
  { path: '/conformite', name: 'conformite', heading: 'Conformité des droits' },
  { path: '/audit', name: 'audit', heading: 'Journal d’audit' },
  { path: '/integrations', name: 'integrations', heading: 'Intégrations' },
];

test.describe('Accessibilité (axe-core, WCAG 2.2 A/AA) et captures', () => {
  test('l’écran d’accueil ne présente aucune violation grave', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(800); // fin du fondu d'entrée (opacité partielle pendant l'animation)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    mkdirSync('screenshots', { recursive: true });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: 'screenshots/accueil.png' });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`les pages du portail sont accessibles en thème ${theme === 'light' ? 'clair' : 'sombre'}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('tp-theme', value), theme);
      await login(page, 'admin.it');
      mkdirSync('screenshots', { recursive: true });
      for (const target of PAGES) {
        await page.goto(target.path);
        await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
        // Pas de « networkidle » : le flux SSE temps réel garde une connexion ouverte en permanence
        await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 20_000 });
        await page.waitForTimeout(target.path === '/' ? 1200 : 400); // fin des compteurs et apparitions
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .exclude('[data-sonner-toaster]')
          .analyze();
        const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
        expect(serious.map((v) => `${target.path} ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        await page.screenshot({ path: `screenshots/${target.name}-${theme}.png`, fullPage: true });
      }
    });
  }

  test('aucune page ne défile horizontalement sur un téléphone (375 px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, 'admin.it');
    const overflowing: string[] = [];
    for (const target of PAGES) {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
      await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 20_000 });
      // Les tableaux larges défilent dans leur propre conteneur : la page, elle, tient dans l'écran
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (extra > 0) overflowing.push(`${target.path} (+${extra} px)`);
    }
    expect(overflowing).toEqual([]);
  });

  test('la navigation au clavier propose le lien d’évitement et la palette de commandes', async ({ page }) => {
    await login(page, 'rh.manager');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog').getByPlaceholder(/Rechercher un employé/)).toBeVisible();
    await page.keyboard.type('annuaire');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/employes/);
  });

  test('les animations sont désactivées quand l’utilisateur le demande', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const preview = page.getByRole('figure', { name: 'Exemple de fiche d’accès' });
    await expect(preview.getByText('Accès ouverts')).toBeVisible();
    await preview.getByRole('tab', { name: 'Arrivée' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(preview.getByText('Profil modifié')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    const departure = preview.getByRole('tabpanel', { name: 'Départ' });
    await expect(departure.getByText('Accès révoqués')).toBeVisible();
    await expect(departure).toHaveCSS('animation-name', 'none');
    await context.close();
  });
});
