import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Glisser-déposer une barre du Gantt : impossible à vérifier avec jsdom
   (pas de rendu, pas de coordonnées d'écran réelles). C'est exactement le
   type de régression que ce lot 5 vise à couvrir. */

const DAY_COL_WIDTH = 36; // ZOOM_CONFIG.day.colWidth dans js/gantt-renderer.js

test('glisser une tâche de 3 jours vers la droite met à jour ses dates', async ({ page }) => {
    const projectName = `E2E Drag ${Date.now()}`;
    const taskName = `Tâche glissée ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Zoom "jour" pour un mapping pixel <-> jour déterministe.
    await page.locator('.zoom-btn[data-zoom="day"]').click();

    // Créer une tâche avec des dates connues.
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    const box = await bar.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 3 * DAY_COL_WIDTH, startY, { steps: 10 });
    await page.mouse.up();

    // Rouvrir la tâche et vérifier que les dates ont bien avancé de 3 jours.
    await bar.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-13');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-15');
    await page.getByRole('button', { name: 'Annuler' }).click();

    await deleteActiveProject(page);
});
