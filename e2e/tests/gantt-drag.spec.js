import { test, expect } from '../fixtures.js';
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

    // Mesurer la largeur réelle des colonnes depuis le DOM après que le Gantt
    // soit complètement rendu (après la création de la tâche).
    const colWidth = await page.evaluate(() => {
        const col = document.querySelector('.gantt-timeline-grid-col');
        if (!col) return 36;
        const width = col.getBoundingClientRect().width;
        return width > 0 ? width : 36;
    });

    const box = await bar.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 3 * colWidth, startY, { steps: 10 });
    await page.mouse.up();

    /* Rouvrir la tâche : le début a avancé de 3 jours, et la durée de 3 jours
       OUVRÉS (lundi 10 → mercredi 12) est gardée. Lâchée le jeudi 13, la
       barre enjambe le week-end — le samedi 15 est en outre l'Assomption —
       et finit donc le lundi 17 (jeudi 13, vendredi 14, lundi 17). L'attendu
       était le samedi 15 : il gardait l'écart CALENDAIRE, soit 2 jours
       ouvrés au lieu de 3 (voir glisser-duree-ouvree.spec.js). */
    await bar.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-13');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-17');
    await page.locator('#taskModalOverlay').locator('button', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
