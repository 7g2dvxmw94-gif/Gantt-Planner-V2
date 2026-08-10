import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique). Avec exactement 2 tâches
   liées par une seule chaîne de dépendance (A → B), aucune des deux n'a
   de marge : les deux doivent donc être signalées comme critiques dès
   l'activation du bouton, et ne plus l'être une fois désactivé. */

test('activer le chemin critique surligne les tâches sans marge', async ({ page }) => {
    const projectName = `E2E CP ${Date.now()}`;
    const nameA = `Tâche A ${Date.now()}`;
    const nameB = `Tâche B ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameA);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameB);
    await page.locator('#taskStart').fill('2026-08-13');
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const barA = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameA });
    const barB = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameB });
    await expect(barA).toBeVisible({ timeout: 10_000 });
    await expect(barB).toBeVisible({ timeout: 10_000 });

    // Lier B à A (Fin→Début) pour former l'unique chaîne du projet.
    await barB.dblclick();
    const predGroup = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    await predGroup.locator('.dep-list > div').filter({ hasText: nameA })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Activer le chemin critique : 2 tâches, une seule chaîne possible,
    // donc marge nulle pour les deux -> toutes deux critiques.
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique : 2 tâches sur 2' })).toBeVisible();
    await expect(barA).toHaveClass(/critical-path/);
    await expect(barB).toHaveClass(/critical-path/);

    // Désactiver : la classe doit disparaître des deux barres.
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique masqué' })).toBeVisible();
    await expect(barA).not.toHaveClass(/critical-path/);
    await expect(barB).not.toHaveClass(/critical-path/);

    await deleteActiveProject(page);
});
