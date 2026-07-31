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

/** Supprime le projet actif via le menu déroulant (confirm() natif accepté). */
export async function deleteActiveProject(page) {
    await waitForAppReady(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.project-selector').click();
    await page.locator('button.project-dropdown-item.danger').click();
}
