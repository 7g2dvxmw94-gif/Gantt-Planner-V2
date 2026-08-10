import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § A1 (créer un projet) et § A2 (basculer entre projets). */

test('créer un projet puis basculer entre deux projets', async ({ page }) => {
    await page.goto('index.html');

    const nameA = `E2E Project A ${Date.now()}`;
    const nameB = `E2E Project B ${Date.now()}`;

    await createProject(page, nameA);
    await createProject(page, nameB);

    // Le projet B (créé en dernier) doit être actif.
    await expect(page.locator('#projectName')).toHaveText(nameB);

    // Basculer vers A via le sélecteur.
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nameA }).click();
    await expect(page.locator('#projectName')).toHaveText(nameA);

    // Nettoyage : supprimer les deux projets créés par ce test.
    await deleteActiveProject(page); // supprime A (actif)
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nameB }).click();
    await deleteActiveProject(page); // supprime B
});

test('renommer le projet actif', async ({ page }) => {
    await page.goto('index.html');

    const original = `E2E Rename Src ${Date.now()}`;
    const renamed = `E2E Rename Dst ${Date.now()}`;
    await createProject(page, original);

    await page.locator('.project-selector').click();

    const projectItem = page.locator('.project-dropdown-item', { hasText: original }).first();
    const actionBtn = projectItem.locator('.project-item-action');

    await actionBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await actionBtn.click();

    const renameInput = page.locator('.project-rename-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5_000 });
    await renameInput.fill(renamed);
    await renameInput.press('Enter');

    await expect(page.locator('#projectName')).toHaveText(renamed);

    await deleteActiveProject(page);
});
