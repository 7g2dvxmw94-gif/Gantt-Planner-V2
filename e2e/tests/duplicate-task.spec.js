import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B8 (dupliquer une tâche) : le menu contextuel
   doit créer une copie indépendante (nom suffixé " (copie)"), en laissant
   la tâche d'origine intacte. */

test('dupliquer une tâche depuis le menu contextuel crée une copie indépendante', async ({ page }) => {
    const projectName = `E2E Dup ${Date.now()}`;
    const taskName = `Tâche source ${Date.now()}`;

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

    await bar.click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Dupliquer' }).click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Tâche dupliquée' })).toBeVisible();

    // La copie apparaît avec le suffixe " (copie)", et l'originale reste
    // intacte (nom exact, sans le suffixe). Le nom de l'originale est une
    // sous-chaîne de celui de la copie : exclure "(copie)" pour ne pas
    // matcher les deux barres avec le même filtre.
    const copyBar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: `${taskName} (copie)` });
    const originalBar = page.locator('.gantt-bar[data-task-id]')
        .filter({ hasText: taskName })
        .filter({ hasNotText: '(copie)' });
    await expect(copyBar).toBeVisible({ timeout: 10_000 });
    await expect(originalBar).toBeVisible();

    await deleteActiveProject(page);
});
