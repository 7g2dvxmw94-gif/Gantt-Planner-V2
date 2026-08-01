import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Test d'intégration "bout en bout" demandé pour vérifier que plusieurs
   fonctionnalités marchent bien ENSEMBLE sur un scénario réaliste, plutôt
   qu'isolément comme les autres specs : plusieurs tâches de durées
   différentes + un jalon, une ressource à taux horaire affectée à
   chacune, la vue Coûts qui calcule juste, puis une baseline.

   Dates choisies lundi→vendredi (aucun week-end) pour que jours
   calendaires = jours ouvrés et que le calcul de coût soit prévisible :
   getTaskCosts() (store.js) facture les jours ouvrés × 8h × taux horaire
   pour une ressource qui ne travaille pas le week-end (réglage par
   défaut). Un jalon n'entre jamais dans ce calcul (exclu explicitement). */

test('projet complet : tâches à durées variées + jalon + ressource + coûts + baseline', async ({ page }) => {
    const projectName = `E2E Full ${Date.now()}`;
    const resourceName = `Resource ${Date.now()}`;
    const task1 = `Conception ${Date.now()}`;   // 5 jours ouvrés
    const task2 = `Revue ${Date.now()}`;        // 2 jours ouvrés
    const task3 = `Livraison ${Date.now()}`;    // 3 jours ouvrés
    const milestoneName = `Lancement ${Date.now()}`;
    const baselineName = `Baseline lancement ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // ---- 1. Ressource à taux horaire (10 €/h, ne travaille pas le week-end) ----
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const resModal = page.locator('.resource-modal');
    await resModal.locator('#resName').fill(resourceName);
    await resModal.locator('.res-rate-toggle-btn', { hasText: 'Taux horaire' }).click();
    await resModal.locator('#resRate').fill('10');
    await resModal.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: resourceName })).toBeVisible();

    await page.locator('#tabTimeline').click();

    // ---- 2. Trois tâches de durées différentes, ressource affectée à chacune ----
    const tasks = [
        { name: task1, start: '2026-08-03', end: '2026-08-07' }, // lun-ven = 5j ouvrés
        { name: task2, start: '2026-08-10', end: '2026-08-11' }, // lun-mar = 2j ouvrés
        { name: task3, start: '2026-08-17', end: '2026-08-19' }, // lun-mer = 3j ouvrés
    ];
    for (const t of tasks) {
        await page.locator('#addTaskBtn').click();
        const modal = page.locator('#taskModalOverlay');
        await modal.locator('#taskName').fill(t.name);
        await modal.locator('#taskStart').fill(t.start);
        await modal.locator('#taskEnd').fill(t.end);
        await modal.locator('.assignee-item', { hasText: resourceName })
            .locator('input[type="checkbox"]').check();
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(modal).toBeHidden();
    }

    // ---- 3. Un jalon (aucune durée, aucun coût) ----
    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="milestone"]').click();
    await page.locator('#taskName').fill(milestoneName);
    await page.locator('#taskStart').fill('2026-08-20');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // ---- 4. Tout est bien visible sur le Gantt ----
    for (const t of tasks) {
        await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: t.name }))
            .toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByRole('button', { name: new RegExp(milestoneName) })).toBeVisible({ timeout: 10_000 });

    // ---- 5. Vue Coûts : coût par tâche et total corrects ----
    await page.locator('#tabCosts').click();
    const expectedCosts = { [task1]: '400 €', [task2]: '160 €', [task3]: '240 €' };
    for (const [name, expected] of Object.entries(expectedCosts)) {
        const row = page.locator('tr.costs-task-row', { hasText: name });
        await expect(row).toBeVisible({ timeout: 10_000 });
        await expect(row.locator('td').nth(5)).toHaveText(expected);
    }
    // Le jalon n'apparaît jamais dans le tableau des coûts.
    await expect(page.locator('tr.costs-task-row', { hasText: milestoneName })).toHaveCount(0);
    // Total = 400 + 160 + 240 = 800 € (volontairement < 1000 € pour éviter
    // l'abréviation "K€" de formatCurrency() et comparer le texte tel quel).
    await expect(page.locator('.costs-kpi').first().locator('.costs-kpi-value')).toHaveText('800 €');

    // ---- 6. Baseline ----
    await page.locator('#baselineBtn').click();
    const popover = page.locator('#baselinePopover');
    await expect(popover).toBeVisible();
    await popover.locator('.bl-create-input').fill(baselineName);
    await popover.locator('.bl-create-btn').click();

    await expect(page.locator('#toastContainer .toast', { hasText: `Baseline "${baselineName}" créée` })).toBeVisible();
    await expect(popover.locator('.bl-pop-item .bl-name', { hasText: baselineName })).toBeVisible();
    await expect(popover.locator('.bl-pop-item', { hasText: baselineName })).toHaveClass(/bl-pop-item--active/);
    await expect(page.locator('#baselineBtn')).toHaveClass(/baseline-has-active/);

    await deleteActiveProject(page);
});
