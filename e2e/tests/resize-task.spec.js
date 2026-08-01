import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § D2 (redimensionner une barre) : glisser la poignée
   droite d'une tâche doit allonger sa durée en ne modifiant que la date de
   fin, sans toucher à la date de début (contrairement au déplacement de la
   barre entière, déjà couvert par gantt-drag.spec.js). */

test('glisser la poignée droite d’une tâche de 2 jours allonge sa durée sans changer la date de début', async ({ page }) => {
    const projectName = `E2E Resize ${Date.now()}`;
    const taskName = `Tâche resize ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Zoom "jour" pour un mapping pixel <-> jour déterministe.
    await page.locator('.zoom-btn[data-zoom="day"]').click();

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    // .modal-overlay retire juste la classe "active" à la fermeture ; opacity
    // ET visibility sont animées sur --transition-base (200ms), et pour une
    // transition CSS "visibility" bascule à hidden seulement en FIN de
    // transition. L'overlay reste donc visible/cliquable ~200ms après le clic
    // sur "Créer" et intercepte un mousedown démarré trop tôt sur la poignée
    // du Gantt en dessous — le resize ne s'enclenche alors jamais silencieusement.
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    const colWidth = await page.evaluate(() => {
        const col = document.querySelector('.gantt-timeline-grid-col');
        if (!col) return 36;
        const width = col.getBoundingClientRect().width;
        return width > 0 ? width : 36;
    });

    const handle = bar.locator('.gantt-bar-handle-right');
    const handleBox = await handle.boundingBox();
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 2 * colWidth, startY, { steps: 10 });
    await page.mouse.up();

    // Rouvrir la tâche : la date de début doit rester inchangée, seule la
    // date de fin avance de 2 jours (durée 2j -> 4j).
    await bar.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-10');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-14');
    await page.locator('#taskModalOverlay').locator('button', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
