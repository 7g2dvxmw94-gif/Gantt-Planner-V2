import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B8 (dupliquer une tâche) : la copie ne partage pas
 * l'ordre de l'original.
 *
 * LE DÉFAUT. _duplicateTask (app.js) copie la tâche, champ `order`
 * compris, et l'ajoute : A(0) dupliquée donne « A (copie) » à l'ordre 0,
 * ex aequo avec A. Leur rang relatif dépend alors de l'ordre du tableau
 * en mémoire, et le WBS les numéroterait au hasard.
 *
 * L'ATTENDU. La copie se place juste après l'original : elle prend
 * l'ordre suivant, et les tâches d'ordre supérieur sont décalées d'un
 * cran. Le tout en UN geste : un seul Ctrl+Z retire la copie ET rend leur
 * ordre aux tâches décalées.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « A:0 A (copie):0 B:1 ». Le discriminant passe. */

async function ordres(page, noms) {
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

test('la copie d\'une tâche prend l\'ordre suivant, en un geste qu\'un Ctrl+Z annule', async ({ page }) => {
    const s = Date.now();
    const A = `A Duplication ${s}`, B = `B Duplication ${s}`, copie = `${A} (copie)`;
    await page.goto('index.html');
    await createProject(page, `E2E OrdreDuplication ${s}`);
    await creer(page, A);
    await creer(page, B);
    const [oA, oB] = await ordres(page, [A, B]);

    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: B }).first().waitFor();
    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: new RegExp(`^${A}$`) }).click({ button: 'right' });
    await page.locator('.context-menu-item', { hasText: 'Dupliquer' }).click();

    /* DISCRIMINANT — LA DUPLICATION A EU LIEU : le Gantt montre A, A
       (copie), B. Ferme « la duplication n'a pas eu lieu ». */
    await expect.poll(async () => (await page.locator('.gantt-row .task-name').evaluateAll(els => els.map(e => e.title)))
        .filter(n => n.includes(` Duplication ${s}`)), { message: 'les tâches du Gantt' }).toEqual([A, copie, B]);

    // --- L'ASSERTION CENTRALE ---
    const [a, c, b] = await ordres(page, [A, copie, B]);
    expect(new Set([a, c, b]).size, `les trois ordres doivent être distincts (A:${a} A (copie):${c} B:${b})`).toBe(3);
    expect(a < c && c < b, `la copie juste après l'original (A:${a} copie:${c} B:${b})`).toBe(true);

    /* UN SEUL Ctrl+Z retire la copie et rend à B son ordre. */
    await page.locator('body').press('Control+z');
    await expect.poll(async () => ordres(page, [A, copie, B]), { message: 'un Ctrl+Z annule toute la duplication' })
        .toEqual([oA, '0 tâche(s)', oB]);

    await deleteActiveProject(page);
});
