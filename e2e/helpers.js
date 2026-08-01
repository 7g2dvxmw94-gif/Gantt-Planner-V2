/* Utilitaires partagés entre les specs E2E. */

/** Attend que App.init() soit passé (store.initFromSupabase() est awaité
 *  avant, donc les listeners comme celui du sélecteur de projet ne sont
 *  attachés qu'à ce moment — cliquer avant ne fait rien). */
export async function waitForAppReady(page) {
    await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 15_000 });
}

/** Crée un projet via le bouton "Nouveau projet" (window.prompt natif). */
export async function createProject(page, name) {
    await waitForAppReady(page);
    page.once('dialog', (dialog) => dialog.accept(name));
    await page.locator('.project-selector').click();
    await page.locator('button.new-project').click();
    await expectProjectName(page, name);
}

export async function expectProjectName(page, name) {
    await page.locator('#projectName').filter({ hasText: name }).waitFor({ timeout: 10_000 });
}

/** Supprime le projet actif via le menu déroulant (confirm() natif accepté).
 *
 *  store.deleteProject() synchronise la suppression vers Supabase de façon
 *  asynchrone (non bloquante pour l'UI) ; attendre le toast de confirmation
 *  garantit que cette écriture réseau est bien terminée avant de continuer
 *  (ex. avant de fermer la page en fin de test). Sans cette attente, le
 *  contexte du test pouvait se fermer avant que la requête de suppression
 *  ne parte, laissant le projet orphelin côté serveur — des dizaines de
 *  projets de test se sont ainsi accumulés en base avant correction. */
export async function deleteActiveProject(page) {
    await waitForAppReady(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.project-selector').click();
    await page.locator('button.project-dropdown-item.danger').click();
    await page.locator('#toastContainer .toast', { hasText: 'Projet supprimé' }).waitFor({ timeout: 10_000 });
}
