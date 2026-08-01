import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B3 (créer un jalon) : un jalon n'a qu'une seule
   date (fin verrouillée sur le début) et se rend comme un losange
   (.gantt-milestone), pas comme une barre classique. */

test('créer un jalon verrouille la date de fin et affiche un losange', async ({ page }) => {
    const projectName = `E2E Milestone ${Date.now()}`;
    const taskName = `Jalon test ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="milestone"]').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    // La date de fin est verrouillée sur la date de début pour un jalon.
    await expect(page.locator('#taskEnd')).toBeDisabled();
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-10');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Le jalon a un role="button" avec un aria-label incluant son nom :
    // getByRole matche sur le nom accessible (contrairement à hasText, qui
    // ne verrait pas de texte visible dans ce losange sans libellé).
    const milestone = page.getByRole('button', { name: new RegExp(taskName) });
    await expect(milestone).toBeVisible({ timeout: 10_000 });
    await expect(milestone).toHaveClass(/gantt-milestone/);

    // Rouvrir : début et fin doivent rester identiques.
    await milestone.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-10');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-10');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
