import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Régression : renommer un projet puis le supprimer aussitôt le faisait
   réapparaître au chargement suivant.

   La RPC serveur `upsert_project` est un UPSERT. Le gestionnaire de
   renommage (js/app.js) appelle store.updateProject() sans attendre la
   promesse : son écriture pouvait donc atterrir APRÈS le DELETE et recréer
   la ligne — orpheline, sans ses tâches déjà parties en cascade. En base,
   ces projets fantômes se reconnaissaient à leur signature : 0 tâche,
   1 membre, et un nom que plus aucun test ne réclamait.

   Le correctif est dans store.deleteProject(), qui attend désormais les
   écritures encore en vol pour ce projet avant d'émettre son DELETE.

   Le test recharge la page pour re-interroger Supabase : sans ce
   rechargement, on ne vérifierait que l'état local, où la suppression a
   toujours été correcte. */

test('renommer un projet puis le supprimer aussitôt ne le fait pas réapparaître', async ({ page }) => {
    const original = `E2E Race Src ${Date.now()}`;
    const renamed = `E2E Race Dst ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, original);

    // --- Renommer depuis le sélecteur de projet ---
    await page.locator('.project-selector').click();
    const item = page.locator('.project-dropdown-item', { hasText: original }).first();
    const actionBtn = item.locator('.project-item-action');
    await actionBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await actionBtn.click();

    const renameInput = page.locator('.project-rename-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5_000 });
    await renameInput.fill(renamed);
    await renameInput.press('Enter');
    await expect(page.locator('#projectName')).toHaveText(renamed);

    /* --- Supprimer dans la foulée ---
       Aucune attente volontaire ici : c'est précisément l'enchaînement
       serré qui déclenchait la course. */
    await deleteActiveProject(page);

    // --- Le rechargement repart de l'état serveur ---
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await expect(
        page.locator('.project-dropdown-item .project-item-name', { hasText: renamed })
    ).toHaveCount(0);
    // L'ancien nom ne doit pas davantage subsister.
    await expect(
        page.locator('.project-dropdown-item .project-item-name', { hasText: original })
    ).toHaveCount(0);
});
