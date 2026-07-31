import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Glisser-déposer une barre du Gantt : impossible à vérifier avec jsdom
   (pas de rendu, pas de coordonnées d'écran réelles). C'est exactement le
   type de régression que ce lot 5 vise à couvrir. */

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

    // .modal-overlay retire juste la classe "active" à la fermeture ; opacity
    // ET visibility sont animées sur --transition-base (200ms), et pour une
    // transition CSS "visibility" bascule à hidden seulement en FIN de
    // transition. L'overlay reste donc visible/cliquable ~200ms après le clic
    // sur "Créer" et intercepte un mousedown démarré trop tôt sur la barre du
    // Gantt en dessous — le drag ne s'enclenche alors jamais silencieusement.
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    // Attendre que le zoom "jour" soit appliqué et calculer la véritable
    // largeur d'une colonne au lieu de la supposer. La largeur peut varier
    // selon les CSS, le zoom appliqué, et autres facteurs de rendu.
    const firstColWidth = await page.evaluate(() => {
        const col = document.querySelector('.gantt-timeline-grid-col');
        return col ? col.getBoundingClientRect().width : 36;
    });

    const box = await bar.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 3 * firstColWidth, startY, { steps: 10 });
    await page.mouse.up();

    // Rouvrir la tâche et vérifier que les dates ont bien avancé de 3 jours.
    await bar.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-13');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-15');
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
