import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B1 (créer une tâche) et § B9 (supprimer) : une
 * tâche créée après une suppression ne prend pas l'ordre d'une autre.
 *
 * LE DÉFAUT. addTask (store.js) donne à la nouvelle tâche
 * `order: tasks.length`, le NOMBRE de tâches du projet. Après une
 * suppression, ce nombre retombe sur un ordre déjà pris : A(0), B(1),
 * C(2) ; B supprimée ; D reçoit 2, l'ordre de C. Deux tâches ex aequo se
 * rangent ensuite selon l'ordre du tableau en mémoire, et le WBS les
 * numéroterait au hasard.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « A:0 C:2 D:2 ». Le discriminant passe. */

async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return noms.map(n => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0].order : `${t.length} tâche(s)`; });
    }, noms);
}

async function creer(page, nom) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill('2026-06-08');
    await page.locator('#taskEnd').fill('2026-06-10');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay'), `la fiche de « ${nom} » doit se fermer`).toBeHidden({ timeout: 15_000 });
}

test('une tâche créée après une suppression prend un ordre libre', async ({ page }) => {
    const s = Date.now();
    const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(k => `${k} Ordre ${s}`);
    await page.goto('index.html');
    await createProject(page, `E2E OrdreNouvelleTache ${s}`);
    for (const n of [A, B, C]) await creer(page, n);

    /* B supprimée par sa fiche (confirmation acceptée). */
    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: B }).dblclick();
    await expect(page.locator('#taskName')).toHaveValue(B);
    page.once('dialog', d => d.accept());
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await creer(page, D);

    /* DISCRIMINANT — LE GANTT MONTRE A, C, D, et B n'y est plus. Ferme « le
       jeu n'a pas les tâches attendues ». */
    const noms = await page.locator('.gantt-row .task-name').evaluateAll(els => els.map(e => e.title));
    expect(noms.filter(n => n.includes(` Ordre ${s}`)).sort(), 'les tâches du Gantt').toEqual([A, C, D]);

    // --- L'ASSERTION CENTRALE ---
    const [oA, oC, oD] = await lire(page, [A, C, D]);
    expect(new Set([oA, oC, oD]).size, `les trois ordres doivent être distincts (A:${oA} C:${oC} D:${oD})`).toBe(3);

    await deleteActiveProject(page);
});
