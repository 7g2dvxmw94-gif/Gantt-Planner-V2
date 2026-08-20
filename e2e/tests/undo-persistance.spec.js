import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1, volet persistance.
 *
 * undo() et redo() restaurent un instantané JSON de tout this._data, puis
 * appellent _save() — le stockage local — et s'arrêtent là. Aucune écriture
 * serveur, dans aucun des deux sens. L'écran et la base divergent alors en
 * silence, et le rechargement tranche en faveur de la base.
 *
 * Seize opérations alimentent cet historique, et TOUTES écrivent en base.
 * Aucune n'est défaite par undo.
 *
 * La divergence va dans les deux sens, d'où deux tests SÉPARÉS — réunis,
 * le premier échec masquerait le second :
 *
 *   1. Annuler une SUPPRESSION : la tâche revient à l'écran mais reste
 *      supprimée en base. C'est le cas grave, parce qu'annuler une
 *      suppression accidentelle est l'usage principal de Ctrl+Z :
 *      l'utilisateur croit avoir sauvé sa tâche, et la perd au
 *      rechargement suivant.
 *
 *   2. Annuler une CRÉATION : la tâche disparaît de l'écran mais subsiste
 *      en base, et ressuscite au rechargement.
 *
 * Le rechargement est l'assertion centrale : sans lui, tout passe déjà —
 * c'est précisément pourquoi undo-redo.spec.js, qui ne recharge jamais,
 * n'a rien vu.
 */

/** Crée une tâche via la modale et attend le rendu de sa barre. */
async function creerTache(page, nom) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill('2026-12-07');
    await page.locator('#taskEnd').fill('2026-12-09');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

/** Rouvre le projet par son nom : après rechargement, se fier au projet
 *  actif masquerait une éventuelle disparition. */
async function ouvrirProjet(page, nom) {
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nom })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nom);
}

test('annuler une suppression de tâche la restaure aussi en base', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E UndoSuppr ${suffixe}`;
    const nomTache  = `Tâche ressuscitée ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    const barre = await creerTache(page, nomTache);

    // Supprimer, puis annuler la suppression.
    page.once('dialog', (dialog) => dialog.accept());
    await barre.click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Supprimer' }).click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Tâche supprimée' })).toBeVisible();
    await expect(barre).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' })).toBeVisible();

    // À l'écran, la tâche est revenue — c'est ce que l'utilisateur constate.
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* --- L'assertion centrale --- La base, elle, n'a rien reçu : la tâche
       y est toujours supprimée, et le rechargement la fait redisparaître. */
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomProjet);
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    await deleteActiveProject(page);
});

test('annuler une création de tâche la retire aussi de la base', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E UndoCreation ${suffixe}`;
    const nomTache  = `Tâche fantôme ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    const barre = await creerTache(page, nomTache);

    await page.keyboard.press('Control+z');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' })).toBeVisible();
    await expect(barre).toHaveCount(0);

    /* --- L'assertion centrale --- La création a bien été écrite en base et
       rien ne l'a défaite : au rechargement, la tâche annulée ressuscite. */
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomProjet);
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toHaveCount(0);

    await deleteActiveProject(page);
});
