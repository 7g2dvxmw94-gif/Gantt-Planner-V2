import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § F2 (filtres) : les filtres "Statut" et "Priorité"
   masquent réellement les tâches non correspondantes dans le Gantt (même
   mécanisme que search.spec.js), se combinent en intersection, et
   "Réinitialiser" réaffiche tout. */

test('les filtres statut et priorité masquent les tâches, se combinent, et se réinitialisent', async ({ page }) => {
    const projectName = `E2E Filters ${Date.now()}`;
    const suffix = Date.now();
    const nameTodoLow = `Tâche todo-basse ${suffix}`;
    const nameDoneHigh = `Tâche terminée-haute ${suffix}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Tâche 1 : priorité basse, laissée à 0% (statut "À faire").
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameTodoLow);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.locator('#taskPriority').selectOption('low');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Tâche 2 : priorité haute, progression à 100% (statut "Terminé" —
    // le statut est calculé automatiquement depuis la progression, le
    // champ #taskStatus est en lecture seule).
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameDoneHigh);
    await page.locator('#taskStart').fill('2026-08-13');
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskProgress').evaluate((el) => {
        el.value = '100';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const barTodoLow = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameTodoLow });
    const barDoneHigh = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameDoneHigh });
    await expect(barTodoLow).toBeVisible({ timeout: 10_000 });
    await expect(barDoneHigh).toBeVisible({ timeout: 10_000 });

    // Filtre Statut : cocher "Terminé" ne garde que la tâche 2.
    await page.locator('#filterStatus .filter-multi-toggle').click();
    await page.locator('#filterStatus .filter-multi-option', { hasText: 'Terminé' }).locator('input[type="checkbox"]').check();
    await expect(barTodoLow).toBeHidden({ timeout: 5_000 });
    await expect(barDoneHigh).toBeVisible();

    // Filtre Priorité en plus (statut="Terminé" ET priorité="Basse") :
    // aucune tâche n'a les deux à la fois (todo-basse est priorité basse
    // mais pas terminée ; terminée-haute est terminée mais priorité haute).
    // Sous une intersection (ET), les deux doivent disparaître — sous une
    // union (OU) l'une des deux réapparaîtrait. C'est ce qui distingue les
    // deux sémantiques.
    await page.locator('#filterPriority .filter-multi-toggle').click();
    await page.locator('#filterPriority .filter-multi-option', { hasText: 'Basse' }).locator('input[type="checkbox"]').check();
    await expect(barTodoLow).toBeHidden();
    await expect(barDoneHigh).toBeHidden({ timeout: 5_000 });

    // Retirer le filtre Statut : la priorité "Basse" seule doit maintenant
    // ne garder que la tâche todo-basse.
    await page.locator('#filterStatus .filter-multi-toggle').click();
    await page.locator('#filterStatus .filter-multi-option', { hasText: 'Terminé' }).locator('input[type="checkbox"]').uncheck();
    await expect(barTodoLow).toBeVisible({ timeout: 5_000 });
    await expect(barDoneHigh).toBeHidden();

    // Réinitialiser : tout doit réapparaître.
    await page.locator('.filter-reset-btn').click();
    await expect(barTodoLow).toBeVisible({ timeout: 5_000 });
    await expect(barDoneHigh).toBeVisible();

    await deleteActiveProject(page);
});
