import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B7 (définir des dépendances) : ajouter un
   prédécesseur ne doit pas se contenter de dessiner une ligne dans le
   Gantt, il doit contraindre automatiquement les dates de la tâche
   successeur. */

test('ajouter un prédécesseur contraint automatiquement les dates de la tâche suivante', async ({ page }) => {
    const projectName = `E2E Deps ${Date.now()}`;
    const nameA = `Tâche A ${Date.now()}`;
    const nameB = `Tâche B ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Tâche A : future prédécesseur, 3 jours ouvrés (lun 10 → mer 12 août 2026).
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameA);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Tâche B : dates initiales sans lien avec A (une semaine avant, 3 jours ouvrés).
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameB);
    await page.locator('#taskStart').fill('2026-08-03');
    await page.locator('#taskEnd').fill('2026-08-05');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Rouvrir B, cocher A comme prédécesseur (type par défaut Fin→Début, décalage 0j).
    const barB = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameB });
    await expect(barB).toBeVisible({ timeout: 10_000 });
    await barB.dblclick();
    const predGroup = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    await predGroup.locator('.dep-list > div').filter({ hasText: nameA })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // B doit être repoussée après la fin de A (12 août), en conservant sa
    // durée d'origine de 3 jours ouvrés : jeu 13 → lun 17 août (le
    // week-end du 15-16 est sauté).
    await barB.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-13');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-17');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
