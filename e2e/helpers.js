/* Utilitaires partagés entre les specs E2E. */

/** Crée un projet via le bouton "Nouveau projet" (window.prompt natif). */
export async function createProject(page, name) {
    page.once('dialog', (dialog) => dialog.accept(name));
    await page.locator('.project-selector').click();
    await page.getByRole('button', { name: /Nouveau projet/i }).click();
    await expectProjectName(page, name);
}

export async function expectProjectName(page, name) {
    await page.locator('#projectName').filter({ hasText: name }).waitFor({ timeout: 10_000 });
}

/** Supprime le projet actif via le menu déroulant (confirm() natif accepté). */
export async function deleteActiveProject(page) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.project-selector').click();
    await page.getByRole('button', { name: /Supprimer/i }).click();
}
