import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § C1 (vue Gantt) : l'ordre de deux tâches ex aequo
 * ne dépend pas de l'ordre du tableau en mémoire.
 *
 * LE DÉFAUT. getTasks, getChildTasks et getTaskTree (store.js) trient par
 * `order` seul. Deux tâches de même ordre — une tâche sortie d'une phase
 * garde son ordre, qu'une autre peut porter — se rangent alors selon leur
 * place dans le tableau en mémoire, qui change avec un rechargement, une
 * écriture reçue d'un collègue ou une annulation. Le Gantt, les exports
 * et la future numérotation WBS changeraient d'ordre sans que personne
 * ait rien déplacé.
 *
 * LE JEU, importé en JSON : A(0), B(2), R(9, phase) ⊃ R1(2), Z(5). R1
 * sort de R par la fiche : B et R1, toutes deux racines, sont ex aequo à
 * l'ordre 2.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : l'ordre du Gantt change quand on inverse le tableau. Les
 * discriminants passent. */

function jeu(suffixe) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E OrdreExAequo ${suffixe}`, description: '' },
        tasks: [t('A', 0), t('B', 2), t('R', 9, { isPhase: true }), t('R1', 2, { parentId: 'jeu-R' }), t('Z', 5)],
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const cles = (textes, suffixe) => textes.map(x => (String(x).match(new RegExp(`(\\S+) ${suffixe}`)) || [])[1]).filter(Boolean);
const lignesGantt = async (page, s) => cles(await page.locator('.gantt-row .task-name').evaluateAll(els => els.map(e => e.title)), s);

async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return noms.map(n => { const t = taches.filter(x => x.name === n); return `${n.split(' ')[0]}:${t.length === 1 ? t[0].order : '?'}`; }).join(' ');
    }, noms);
}

test('deux tâches ex aequo gardent leur rang quand le tableau en mémoire change d\'ordre', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const [A, B, R, R1, Z] = donnees.tasks.map(t => t.name);
    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({ name: 'ordre-ex-aequo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` })).toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* R1 sort de R par la fiche (« Phase parente » : aucune). */
    await page.locator('.gantt-bar[data-task-id]:not(.phase-bar)').filter({ hasText: R1 }).dblclick();
    await expect(page.locator('#taskName')).toHaveValue(R1);
    await page.locator('#taskParent').selectOption('');
    await (await present(page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT 1 — B ET R1 SONT EX AEQUO, à l'ordre 2, et R1 est racine. */
    expect(await lire(page, [B, R1]), 'B et R1 ex aequo').toBe('B:2 R1:2');
    const avant = await lignesGantt(page, s);
    expect(avant.length, 'les cinq tâches au Gantt').toBe(5);

    /* Le tableau en mémoire est inversé, puis le Gantt redessiné. */
    const premiers = await page.evaluate(async () => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { ganttRenderer } = await import(new URL('js/gantt-renderer.js', base).href);
        const avant = store._data.tasks[0].id;
        store._data.tasks.reverse();
        store._invalidateTaskIndex && store._invalidateTaskIndex();
        ganttRenderer.render();
        return { avant, apres: store._data.tasks[0].id };
    });
    /* DISCRIMINANT 2 — LE TABLEAU A BIEN CHANGÉ D'ORDRE. Ferme « l'inversion
       n'a rien fait, le test ne mesure rien ». */
    expect(premiers.apres, 'le premier élément du tableau a changé').not.toBe(premiers.avant);

    // --- L'ASSERTION CENTRALE ---
    await expect.poll(async () => lignesGantt(page, s), { message: 'l\'ordre du Gantt ne dépend pas du tableau' }).toEqual(avant);

    await deleteActiveProject(page);
});
