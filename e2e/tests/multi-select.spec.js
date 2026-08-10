import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B10 (sélection multiple), dans la limite de ce qui
   est réellement implémenté dans la vue Tableau : Ctrl+Clic étend la
   sélection (le "Shift+Clic = plage" décrit dans le plan de test n'existe
   pas dans le code actuel — seul le mode "append" via Ctrl/Cmd est câblé),
   et la barre d'actions groupées peut supprimer toutes les tâches
   sélectionnées d'un coup. */

test('Ctrl+Clic sélectionne plusieurs tâches, la suppression groupée les retire toutes', async ({ page }) => {
    const projectName = `E2E MultiSelect ${Date.now()}`;
    const name1 = `Tâche 1 ${Date.now()}`;
    const name2 = `Tâche 2 ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(name1);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(name2);
    await page.locator('#taskStart').fill('2026-08-13');
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#tabBoard').click();
    const row1 = page.locator('tr[data-task-id]').filter({ hasText: name1 });
    const row2 = page.locator('tr[data-task-id]').filter({ hasText: name2 });
    await expect(row1).toBeVisible({ timeout: 10_000 });
    await expect(row2).toBeVisible();

    await row1.click({ modifiers: ['Control'] });
    await row2.click({ modifiers: ['Control'] });
    await expect(page.locator('.batch-count')).toHaveText('2 tâches sélectionnées');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.batch-btn.danger', { hasText: 'Supprimer' }).click();

    await expect(page.locator('#toastContainer .toast', { hasText: '2 tâches supprimées' })).toBeVisible();
    await expect(row1).toHaveCount(0);
    await expect(row2).toHaveCount(0);

    await deleteActiveProject(page);
});
