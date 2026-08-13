import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Régression : une tâche assignée perdait l'affichage de ses assignés dès
   que l'équipe du projet devenait vide.

   _renderAssigneeList() (js/task-modal.js) rend d'abord l'équipe projet,
   puis _extraResources — les ressources assignées à la tâche mais hors
   équipe, dont l'existence même prouve que ce cas est prévu. Mais l'indice
   « équipe vide » intercalé entre les deux retournait immédiatement : dès
   que l'équipe projet était vide, la fonction sortait AVANT d'atteindre le
   rendu des hors-équipe. Plus aucune ligne .assignee-item, alors même que
   la tâche avait des assignés.

   Conséquence pour l'utilisateur : impasse. Les identifiants restaient dans
   _selectedAssigneeIds (donc une sauvegarde les réécrivait intacts), mais
   plus aucune case n'était affichée — impossible de désassigner ce qu'on ne
   voit pas.

   Le chemin est atteignable depuis l'interface : retirer du projet la
   dernière ressource (app.js:1301 → store.removeResourceFromProject) ne
   purge pas les assignés des tâches, contrairement à la suppression d'une
   ressource (store.js:2335). C'est exactement ce que ce test reproduit. */

test('assignés hors équipe : ils restent visibles quand le projet n\'a plus de ressource', async ({ page }) => {
    const horodatage   = Date.now();
    const nomProjet    = `E2E HorsEquipe ${horodatage}`;
    const nomRessource = `Ressource HorsEquipe ${horodatage}`;
    const nomTache     = `Tâche assignée ${horodatage}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Une ressource, créée dans le projet : elle en fait donc l'équipe ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(nomRessource);
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible();

    // --- Une tâche, assignée à cette ressource ---
    await page.locator('#tabTimeline').click();
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nomTache);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');

    /* La ressource appartient à l'équipe : elle est rendue par la première
       boucle, sans le marqueur --out. On coche pour créer l'assignation. */
    const ligneEquipe = page.locator('#taskModalOverlay .assignee-item', { hasText: nomRessource });
    await expect(ligneEquipe).toBeVisible();
    await ligneEquipe.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* --- Vider l'équipe du projet, sans supprimer la ressource ---
       Retirer ≠ supprimer : la ressource continue d'exister globalement et
       reste assignée à la tâche. C'est le geste qui déclenche le bug. */
    await page.locator('#tabResources').click();
    await page.locator('.resource-card', { hasText: nomRessource })
        .locator('.resource-assign-btn--in').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Ressource retirée du projet' }))
        .toBeVisible();
    // Portée « Ce projet » (défaut) : l'équipe est bien vide.
    await expect(page.locator('.resource-card')).toHaveCount(0);

    // --- L'assertion qui mord : rouvrir la tâche, l'assigné doit survivre ---
    await page.locator('#tabTimeline').click();
    await barre.dblclick();
    const ligneHorsEquipe = page.locator('#taskModalOverlay .assignee-item', { hasText: nomRessource });
    await expect(ligneHorsEquipe).toBeVisible({ timeout: 10_000 });
    // Toujours cochée : l'assignation n'a pas été perdue, seulement masquée.
    await expect(ligneHorsEquipe.locator('input[type="checkbox"]')).toBeChecked();
    // Et signalée comme hors équipe, pour que l'utilisateur comprenne pourquoi.
    await expect(ligneHorsEquipe).toHaveClass(/assignee-item--out/);
    await expect(ligneHorsEquipe).toContainText('Hors équipe');

    /* L'indice « équipe vide » reste affiché : il est utile ici, l'équipe
       étant réellement vide. Le correctif le conserve — il supprime le
       court-circuit, pas le message. */
    await expect(page.locator('#taskModalOverlay .assignee-empty--pool')).toBeVisible();

    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Nettoyage : la ressource (hors projet, donc portée « Toutes »), puis le projet ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.resource-card', { hasText: nomRessource })
        .locator('.resource-action-delete').click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toHaveCount(0);

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
