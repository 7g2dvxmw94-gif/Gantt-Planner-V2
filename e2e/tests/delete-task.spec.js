import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B9 (supprimer une tâche) via le menu contextuel. */

test('supprimer une tâche depuis le menu contextuel la retire du Gantt', async ({ page }) => {
    const projectName = `E2E Delete ${Date.now()}`;
    const taskName = `Tâche à supprimer ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await bar.click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Supprimer' }).click();

    await expect(page.locator('#toastContainer .toast', { hasText: 'Tâche supprimée' })).toBeVisible();
    await expect(bar).toHaveCount(0);

    await deleteActiveProject(page);
});
