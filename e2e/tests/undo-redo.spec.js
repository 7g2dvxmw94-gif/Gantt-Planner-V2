import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourcis Ctrl+Z / Ctrl+Y) et les boutons
   Annuler / Rétablir de la barre d'outils, qui partagent la même pile
   d'historique dans store.js (_undoStack / _redoStack).

   Les deux tests annulent une *création* de tâche : store._snapshot() est
   appelé avant chaque mutation, donc un seul Ctrl+Z ramène à l'état
   d'avant la création — sans toucher au projet lui-même, dont la création
   occupe l'entrée précédente de la pile (et qu'il faut garder pour le
   nettoyage de fin de test). */

/** Crée une tâche via la modal et attend que sa barre soit rendue. */
async function createTask(page, taskName) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });
    return bar;
}

test('Ctrl+Z annule la création d\'une tâche, Ctrl+Y la rétablit', async ({ page }) => {
    const projectName = `E2E Undo ${Date.now()}`;
    const taskName = `Tâche annulable ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    const bar = await createTask(page, taskName);

    // Le handler est posé sur window en phase de capture : le raccourci
    // fonctionne quel que soit l'élément qui a le focus après la modal.
    await page.keyboard.press('Control+z');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' })).toBeVisible();
    await expect(bar).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action rétablie' })).toBeVisible();
    await expect(bar).toBeVisible({ timeout: 10_000 });

    // Le projet doit avoir survécu à l'aller-retour dans l'historique.
    await expect(page.locator('#projectName')).toContainText(projectName);

    await deleteActiveProject(page);
});

test('les boutons Annuler / Rétablir de la barre d\'outils pilotent le même historique', async ({ page }) => {
    const projectName = `E2E UndoBtn ${Date.now()}`;
    const taskName = `Tâche bouton ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    const bar = await createTask(page, taskName);

    await page.locator('#undoBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' })).toBeVisible();
    await expect(bar).toHaveCount(0);

    await page.locator('#redoBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action rétablie' })).toBeVisible();
    await expect(bar).toBeVisible({ timeout: 10_000 });

    await deleteActiveProject(page);
});
