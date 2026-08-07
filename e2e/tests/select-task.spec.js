import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre la répartition clic simple / double-clic, alignée sur
   TEST_PLAN.md § B5 (« double-cliquer sur tâche » ouvre la fiche) et
   § B10 (sélection) :

   - clic simple      → sélectionne la tâche, sans ouvrir la fiche ;
   - Ctrl+Clic        → étend la sélection ;
   - Échap            → efface la sélection ;
   - double-clic      → ouvre la modal d'édition.

   Les deux vues (Gantt et Tableau) doivent répondre à l'identique : c'est
   la raison d'être du second test, le même geste ne devant pas avoir deux
   effets selon l'onglet ouvert. */

/** Crée une tâche via la modal et attend que sa barre soit rendue. */
async function createTask(page, name, start, end) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(name);
    await page.locator('#taskStart').fill(start);
    await page.locator('#taskEnd').fill(end);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: name }))
        .toBeVisible({ timeout: 10_000 });
}

test('sur le Gantt : clic simple sélectionne, Ctrl+Clic étend, Échap efface, double-clic ouvre la fiche', async ({ page }) => {
    const projectName = `E2E Select ${Date.now()}`;
    const name1 = `Tâche A ${Date.now()}`;
    const name2 = `Tâche B ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);
    await createTask(page, name1, '2026-08-10', '2026-08-12');
    await createTask(page, name2, '2026-08-13', '2026-08-14');

    const bar1 = page.locator('.gantt-bar[data-task-id]').filter({ hasText: name1 });
    const bar2 = page.locator('.gantt-bar[data-task-id]').filter({ hasText: name2 });
    const modal = page.locator('#taskModalOverlay');
    const batchBar = page.locator('#batchActionBar');

    // --- Clic simple : sélectionne, et n'ouvre PAS la fiche ---
    await bar1.click();
    await expect(bar1).toHaveClass(/selected/);
    await expect(batchBar).toContainText('1 tâche sélectionnée');
    // openEdit() est appelé de façon synchrone dans le handler de clic :
    // si le clic simple ouvrait encore la fiche, elle serait déjà visible.
    await expect(modal).toBeHidden();

    // --- Ctrl+Clic : étend la sélection ---
    await bar2.click({ modifiers: ['Control'] });
    await expect(bar1).toHaveClass(/selected/);
    await expect(bar2).toHaveClass(/selected/);
    await expect(batchBar).toContainText('2 tâches sélectionnées');

    /* --- Clic simple sans modificateur : la sélection redevient exclusive ---
       On revient sur bar1, pas sur bar2 : deux clics simples consécutifs sur
       la MÊME cible seraient fusionnés en double-clic par le navigateur s'ils
       tombent dans l'intervalle système, ce qui ouvrirait la fiche au milieu
       du test. Le clic intercalé sur l'autre barre casse la séquence. */
    await bar1.click();
    await expect(bar1).toHaveClass(/selected/);
    await expect(bar2).not.toHaveClass(/selected/);
    await expect(batchBar).toContainText('1 tâche sélectionnée');

    // --- Échap : efface la sélection et retire la barre d'actions groupées ---
    await page.keyboard.press('Escape');
    await expect(bar1).not.toHaveClass(/selected/);
    await expect(batchBar).toHaveCount(0);

    /* --- Double-clic : ouvre la fiche de la bonne tâche ---
       Sur bar2, alors que le dernier clic simple portait sur bar1 : la paire
       de clics est donc propre, et on vérifie au passage que la fiche ouverte
       est bien celle de la barre double-cliquée, pas celle restée en
       sélection. */
    await bar2.dblclick();
    await expect(modal).toBeVisible();
    await expect(page.locator('#taskName')).toHaveValue(name2);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await deleteActiveProject(page);
});

test('dans la vue Tableau : clic simple sélectionne la ligne, double-clic ouvre la fiche', async ({ page }) => {
    const projectName = `E2E SelectTable ${Date.now()}`;
    const taskName = `Tâche tableau ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);
    await createTask(page, taskName, '2026-08-10', '2026-08-12');

    await page.locator('#tabBoard').click();
    const row = page.locator('tr[data-task-id]').filter({ hasText: taskName });
    await expect(row).toBeVisible({ timeout: 10_000 });

    const modal = page.locator('#taskModalOverlay');

    await row.click();
    await expect(row).toHaveClass(/selected/);
    await expect(page.locator('#batchActionBar')).toContainText('1 tâche sélectionnée');
    await expect(modal).toBeHidden();

    await row.dblclick();
    await expect(modal).toBeVisible();
    await expect(page.locator('#taskName')).toHaveValue(taskName);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await deleteActiveProject(page);
});
