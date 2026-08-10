import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § F1 (barre de recherche Ctrl+F) : le raccourci doit
   donner le focus au champ, la saisie doit filtrer les tâches du Gantt par
   nom (masquer les non-correspondantes, pas seulement les surligner), et
   Échap doit vider le champ et tout réafficher. */

test('Ctrl+F puis une recherche filtre les tâches par nom, Échap réinitialise', async ({ page }) => {
    const projectName = `E2E Search ${Date.now()}`;
    const suffix = Date.now();
    const nameMatch = `Fondations ${suffix}`;
    const nameOther = `Toiture ${suffix}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameMatch);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameOther);
    await page.locator('#taskStart').fill('2026-08-13');
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const barMatch = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameMatch });
    const barOther = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameOther });
    await expect(barMatch).toBeVisible({ timeout: 10_000 });
    await expect(barOther).toBeVisible({ timeout: 10_000 });

    // Ctrl+F doit donner le focus au champ de recherche.
    await page.keyboard.press('Control+f');
    await expect(page.locator('#searchInput')).toBeFocused();

    // Saisir un texte qui ne correspond qu'à une seule tâche : l'autre
    // doit disparaître du Gantt (le filtre a un debounce de 200ms).
    await page.locator('#searchInput').fill('Fondations');
    await expect(barOther).toBeHidden({ timeout: 5_000 });
    await expect(barMatch).toBeVisible();

    // Échap : vide le champ, retire le focus, et réaffiche tout.
    await page.keyboard.press('Escape');
    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(page.locator('#searchInput')).not.toBeFocused();
    await expect(barOther).toBeVisible({ timeout: 5_000 });

    await deleteActiveProject(page);
});
