import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Régression : une ressource affectée à un second projet perdait son
   rattachement au rechargement de la page (project.resourceIds était
   reconstruit puis immédiatement écrasé par un filtre ne gardant que le
   projet propriétaire — voir store.js initFromSupabase/_loadProjectData).
   Ce test couvre le partage réel, persistant, entre deux projets. */

test('une ressource affectée à un second projet reste visible après rechargement', async ({ page }) => {
    const resourceName = `E2E Res ${Date.now()}`;
    const projectA = `E2E Res Project A ${Date.now()}`;
    const projectB = `E2E Res Project B ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectA);

    // Créer la ressource : elle est rattachée au projet actif (A).
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const resModal = page.locator('.resource-modal');
    await resModal.locator('#resName').fill(resourceName);
    await resModal.getByRole('button', { name: 'Créer la ressource' }).click();

    await expect(page.locator('.resource-card', { hasText: resourceName })).toBeVisible();

    // Créer un second projet B (devient le projet actif).
    await createProject(page, projectB);
    await page.locator('#tabResources').click();

    // La ressource créée sur A n'apparaît pas encore dans la portée "Ce
    // projet" de B : basculer sur "Toutes les ressources" pour la retrouver.
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    const card = page.locator('.resource-card', { hasText: resourceName });
    await expect(card).toBeVisible();

    // L'affecter au projet B actif.
    await card.locator('.resource-assign-btn--out').click();

    // Recharger la page : reproduit exactement le scénario du bug, où le
    // rattachement partagé disparaissait car resourceIds était recalculé
    // puis écrasé par un filtre ne gardant que le projet propriétaire.
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#tabResources').click();

    // Portée par défaut "Ce projet" : la ressource partagée doit rester
    // visible sur B après rechargement.
    await expect(page.locator('.resource-card', { hasText: resourceName })).toBeVisible({ timeout: 10_000 });

    // Nettoyage : supprimer la ressource puis les deux projets.
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.resource-card', { hasText: resourceName }).locator('.resource-action-delete').click();
    await expect(page.locator('.resource-card', { hasText: resourceName })).toHaveCount(0);

    await deleteActiveProject(page); // supprime B (actif)
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectA }).click();
    await deleteActiveProject(page); // supprime A
});
