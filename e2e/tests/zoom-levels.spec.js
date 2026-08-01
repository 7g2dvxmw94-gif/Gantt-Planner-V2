import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E1 (niveaux de zoom) : chaque bouton de zoom doit
   devenir actif et changer effectivement la largeur des colonnes de la
   grille du Gantt (pas juste l'état visuel du bouton). */

test('les 4 niveaux de zoom changent la largeur des colonnes et l’état actif', async ({ page }) => {
    const projectName = `E2E Zoom ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Une tâche pour avoir un Gantt non vide (la grille est rendue dans
    // tous les cas, mais ça reste plus représentatif d'un usage réel).
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(`Tâche zoom ${Date.now()}`);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const colWidth = async () => page.evaluate(() => {
        const col = document.querySelector('.gantt-timeline-grid-col');
        return col ? col.getBoundingClientRect().width : 0;
    });

    // Semaine est le zoom par défaut.
    await expect(page.locator('.zoom-btn[data-zoom="week"]')).toHaveClass(/active/);
    const weekWidth = await colWidth();
    expect(weekWidth).toBeGreaterThan(0);

    await page.locator('.zoom-btn[data-zoom="day"]').click();
    await expect(page.locator('.zoom-btn[data-zoom="day"]')).toHaveClass(/active/);
    await expect(page.locator('.zoom-btn[data-zoom="week"]')).not.toHaveClass(/active/);
    const dayWidth = await colWidth();
    expect(dayWidth).toBeLessThan(weekWidth);

    await page.locator('.zoom-btn[data-zoom="month"]').click();
    await expect(page.locator('.zoom-btn[data-zoom="month"]')).toHaveClass(/active/);
    const monthWidth = await colWidth();
    expect(monthWidth).toBeGreaterThan(weekWidth);

    await page.locator('.zoom-btn[data-zoom="quarter"]').click();
    await expect(page.locator('.zoom-btn[data-zoom="quarter"]')).toHaveClass(/active/);
    const quarterWidth = await colWidth();
    expect(quarterWidth).toBeGreaterThan(dayWidth);

    // Le niveau de zoom est persisté : un rechargement doit le conserver.
    await page.reload();
    await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 15_000 });
    await expect(page.locator('.zoom-btn[data-zoom="quarter"]')).toHaveClass(/active/);

    await deleteActiveProject(page);
});
