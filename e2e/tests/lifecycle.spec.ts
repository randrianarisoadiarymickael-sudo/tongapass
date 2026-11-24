import { expect, test } from '@playwright/test';
import { fillPlannedArrival, login, randomName } from './helpers';

test.describe('Cycle de vie complet d’un employé', () => {
  test('arrivée automatisée, changement de poste puis départ avec révocation', async ({ page }) => {
    const lastName = randomName();
    const username = `fanja.${lastName.toLowerCase()}`;
    await login(page, 'rh.manager');
    await expect(page.getByRole('heading', { level: 1, name: 'Vue d’ensemble' })).toBeVisible();

    // --- Déclaration d'arrivée (assistant en 3 étapes)
    await page.getByRole('link', { name: 'Déclarer une arrivée' }).first().click();
    await expect(page.getByRole('heading', { name: 'Déclarer une arrivée' })).toBeVisible();

    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Indiquez le prénom (2 caractères minimum)')).toBeVisible();

    await page.getByLabel('Prénom').fill('Fanja');
    await page.getByLabel('Nom', { exact: true }).fill(lastName);
    await page.getByLabel('E-mail personnel').fill(`${username}@example.org`);
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByLabel('Intitulé du poste').fill('Développeuse back-end');
    await page.getByLabel('Service').fill('Engineering');
    await page.getByLabel(/^Manager/).fill('Toky Andrianina');
    await page.getByLabel(/^E-mail du manager/).fill('toky.andrianina@tongapass.local');
    await page.getByText('Développement back-end', { exact: true }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();

    // --- Vérification : identité générée, droits au moindre privilège, calendrier
    await expect(page.getByRole('heading', { name: 'Identité générée' })).toBeVisible();
    await expect(page.getByText(username, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accès accordés' })).toBeVisible();
    await expect(page.getByText('Comptes créés dès la validation.')).toBeVisible();
    await page.getByRole('button', { name: 'Créer les comptes' }).click();

    // --- Suivi en direct : chaque étape se valide au rappel signé de n8n
    await expect(page).toHaveURL(/\/executions\//);
    await expect(page.getByText('Compte Keycloak créé')).toBeVisible();
    await expect(page.getByText('Terminée', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('E-mail de bienvenue')).toBeVisible();

    // --- Fiche employé : actif, comptes provisionnés
    await page.getByRole('link', { name: `Fanja ${lastName}` }).click();
    const title = page.getByRole('heading', { level: 1, name: `Fanja ${lastName}` });
    await expect(title).toBeVisible();
    // Le badge de statut est voisin du titre
    const status = title.locator('xpath=..');
    await expect(status.getByText('Actif', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comptes provisionnés' })).toBeVisible();

    // --- Mobilité interne : aperçu de l'écart de droits avant application
    await page.getByRole('button', { name: 'Changer de poste' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nouveau profil d’accès').selectOption({ label: 'Ingénierie DevOps' });
    await expect(dialog.getByText('(ajouté)').first()).toBeAttached();
    await expect(dialog.getByText(/Développement back-end → Ingénierie DevOps/)).toBeVisible();
    await dialog.getByLabel('Intitulé de poste').fill('Ingénieure DevOps');
    await dialog.getByRole('button', { name: 'Appliquer la mobilité' }).click();
    await expect(page.getByText('Mobilité lancée')).toBeVisible();

    await page.getByRole('tab', { name: /Exécutions/ }).click();
    const latest = page.locator('#latest-run');
    await expect(latest.getByRole('heading', { name: /Mobilité/ })).toBeVisible();
    await expect(latest.getByText('Terminée', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Ingénieure DevOps').first()).toBeVisible();

    // --- Départ immédiat : confirmation obligatoire par l'identifiant
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('menuitem', { name: 'Déclarer le départ…' }).click();
    dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Révoquer les accès' });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(/Recopiez l’identifiant/).fill(username);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('Révocation lancée')).toBeVisible();

    await expect(status.getByText('Parti', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /Exécutions/ }).click();
    await expect(page.getByText('Compte Keycloak désactivé').first()).toBeVisible();

    // --- Historique : chaque action est tracée sur la fiche
    await page.getByRole('tab', { name: 'Historique' }).click();
    const history = page.getByRole('tabpanel', { name: 'Historique' });
    await expect(history.getByText('Départ terminé').first()).toBeVisible();
    // Historique paginé, du plus récent au plus ancien : la mobilité est plus loin
    await expect(history.getByText(/Page 1 sur \d+/)).toBeVisible();
    await history.getByRole('button', { name: 'Suivante' }).click();
    await expect(history.getByText('Mobilité demandée').first()).toBeVisible();
  });

  test('une arrivée planifiée peut être annulée avant la création des comptes', async ({ page }) => {
    const lastName = randomName();
    await login(page, 'rh.manager');
    await fillPlannedArrival(page, 'Mialy', lastName);

    // La veille de l'arrivée est proposée par défaut
    await expect(page.getByRole('radio', { name: 'La veille de l’arrivée' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Planifier l’arrivée' }).click();
    await expect(page.getByText('Arrivée enregistrée')).toBeVisible();
    await expect(page.getByText(/Exécution planifiée le/)).toBeVisible();

    // Action irréversible : confirmation qui décrit la conséquence, choix sûr focalisé par défaut
    await page.getByRole('button', { name: 'Annuler l’arrivée' }).click();
    const confirm = page.getByRole('alertdialog', { name: `Annuler l’arrivée de Mialy ${lastName} ?` });
    await expect(confirm.getByText(/Aucun compte ne sera créé/)).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Garder l’arrivée' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Annuler l’arrivée' }).click();
    await expect(page.getByText('Planification annulée')).toBeVisible();
    await expect(confirm).toBeHidden();
    await expect(page.getByText('Annulée', { exact: true }).first()).toBeVisible();
  });

  test('l’assistant récapitule les erreurs et conserve la saisie en brouillon', async ({ page }) => {
    await login(page, 'rh.manager');
    await page.goto('/arrivees/nouvelle');

    // Plusieurs erreurs : le récapitulatif reçoit le focus et mène à chaque champ
    await page.getByRole('button', { name: 'Continuer' }).click();
    const summary = page.getByRole('alert', { name: '3 champs à corriger' });
    await expect(summary).toBeFocused();
    await summary.getByRole('button', { name: 'E-mail personnel' }).click();
    const email = page.getByLabel('E-mail personnel');
    await expect(email).toBeFocused();

    // Validation à la sortie d'un champ rempli
    await email.fill('pas-une-adresse');
    await page.getByLabel('Prénom').focus();
    await expect(page.getByText(/Adresse e-mail invalide/)).toBeVisible();
    await page.getByLabel('Prénom').fill('Voahangy');

    // Brouillon : la saisie survit à un changement de page
    await page.getByRole('link', { name: 'Annuaire' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Annuaire' })).toBeVisible();
    await page.getByRole('link', { name: 'Nouvelle arrivée' }).click();
    await expect(page.getByText(/Saisie reprise là où vous l’aviez laissée/)).toBeVisible();
    await expect(page.getByLabel('Prénom')).toHaveValue('Voahangy');
    await page.getByRole('button', { name: 'Recommencer' }).click();
    await expect(page.getByLabel('Prénom')).toHaveValue('');
  });

  test('le fil d’Ariane ramène à l’annuaire avec ses filtres', async ({ page }) => {
    // Le test crée son propre employé : il ne dépend pas des données laissées par les autres
    const lastName = randomName();
    await login(page, 'rh.manager');
    await fillPlannedArrival(page, 'Nirina', lastName);
    await page.getByRole('button', { name: 'Planifier l’arrivée' }).click();
    await expect(page.getByText('Arrivée enregistrée')).toBeVisible();

    await page.goto(`/employes?statut=incoming&q=${lastName}`);
    await page.locator('tbody a').filter({ hasText: lastName }).first().click();
    await expect(page).toHaveURL(/\/employes\/[0-9a-f-]{36}/);
    await page.getByRole('tab', { name: 'Historique' }).click();
    await page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByRole('link', { name: 'Annuaire' }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === '/employes' && url.searchParams.get('statut') === 'incoming' && url.searchParams.get('q') === lastName,
    );
    await expect(page.getByRole('radio', { name: 'En arrivée' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('searchbox', { name: 'Rechercher un employé' })).toHaveValue(lastName);
  });

  test('la recherche de l’annuaire est conservée dans l’URL', async ({ page }) => {
    await login(page, 'rh.manager');
    await page.getByRole('link', { name: 'Annuaire' }).click();
    await page.getByRole('searchbox', { name: 'Rechercher un employé' }).fill('fanja');
    await expect(page).toHaveURL(/q=fanja/);
    await page.reload();
    await expect(page.getByRole('searchbox', { name: 'Rechercher un employé' })).toHaveValue('fanja');
  });
});
