import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Contrôle d’accès par rôle (moindre privilège)', () => {
  test('un salarié sans rôle TongaPass est refusé', async ({ page }) => {
    await login(page, 'dev.lambda');
    await expect(page.getByRole('heading', { name: 'Accès au portail refusé' })).toBeVisible();
  });

  test('l’auditeur consulte le journal mais ne peut pas déclarer d’arrivée', async ({ page }) => {
    await login(page, 'auditeur');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Journal d’audit' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Nouvelle arrivée' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Conformité' })).toBeVisible();

    await nav.getByRole('link', { name: 'Journal d’audit' }).click();
    await page.getByRole('button', { name: 'Vérifier l’intégrité' }).click();
    await expect(page.getByText(/Chaîne intègre : .* entrées vérifiées/)).toBeVisible();

    await page.goto('/arrivees/nouvelle');
    await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible();
  });

  test('le RH n’a pas accès au journal d’audit', async ({ page }) => {
    await login(page, 'rh.manager');
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Journal d’audit' })).toHaveCount(0);
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible();
  });

  test('l’administrateur IAM gère les profils d’accès', async ({ page }) => {
    await login(page, 'admin.it');
    await page.getByRole('link', { name: 'Profils d’accès' }).click();
    await expect(page.getByRole('button', { name: 'Nouveau profil' })).toBeEnabled();
    await expect(page.getByText('Ingénierie DevOps')).toBeVisible();
  });
});
