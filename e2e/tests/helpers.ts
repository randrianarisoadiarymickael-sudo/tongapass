import { expect, type Page } from '@playwright/test';

export type DemoUser = 'rh.manager' | 'admin.it' | 'auditeur' | 'dev.lambda';

/** Connexion par le flux OIDC complet (redirection, PKCE, retour sur le portail). */
export async function login(page: Page, user: DemoUser): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter avec Keycloak' }).click();
  await page.getByRole('button', { name: new RegExp(user.replace('.', '\\.')) }).click();
  if (user !== 'dev.lambda') {
    // Menu du compte : dans la barre supérieure sur toutes les largeurs (sur téléphone, la
    // navigation principale est repliée dans un tiroir et n'est donc pas visible)
    await expect(page.getByRole('button', { name: /^Compte de / })).toBeVisible();
  }
}

/**
 * Remplit l'assistant pour une arrivée dans 10 jours (profil Support client) et s'arrête à
 * l'étape de vérification, avant l'envoi. Aucune exécution n'est lancée : comptes créés la veille.
 */
export async function fillPlannedArrival(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.goto('/arrivees/nouvelle');
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByLabel('E-mail personnel').fill(`${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.org`);
  await page.getByRole('button', { name: 'Continuer' }).click();

  const start = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Intitulé du poste').fill('Chargée de support');
  await page.getByLabel('Service').fill('Support');
  await page.getByLabel('Date d’arrivée').fill(start);
  await page.getByText('Support client', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
}

export const unique = () => Math.random().toString(36).slice(2, 7);

/** Nom aléatoire mais réaliste (lettres uniquement : le formulaire refuse les chiffres). */
export function randomName(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const suffix = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `Rakoto${suffix}`;
}
