import { test, expect } from '../fixtures.js';

/* WBS, fonctionnalité F1 : numéroter les tâches selon la structure de
 * découpage du projet (1, 2, 2.1, 2.1.3…), sans champ en base.
 *
 * LA RÈGLE (js/wbs.js). Le code se calcule sur l'arbre de
 * store.getTaskTree(), celui que dessine le Gantt et que suivent les
 * exports (#137) : les racines sont le niveau 1, numérotées dans l'ordre
 * de l'arbre ; un enfant prend le code de son parent, un point, puis son
 * rang parmi ses frères à partir de 1. Toutes les lignes sont numérotées.
 * Une tâche absente de l'arbre (parent disparu, boucle) n'a pas de code.
 *
 * LE MONTAGE. Le vrai getTaskTree, sur un objet qui hérite du prototype du
 * store et ne lit que le jeu (modèle de dcma-calcul.spec.js) : aucune
 * écriture sur le compte partagé.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 2 failed, chacun sur son
 * assertion centrale, store.getWbs n'existant pas encore (codes reçus :
 * aucun). Les discriminants — l'arbre lui-même — passent avant comme
 * après. */

const T = (id, order, extra = {}) => ({
    id, name: id, order, parentId: null, isPhase: false, isMilestone: false,
    startDate: '2026-06-08', endDate: '2026-06-10', progress: 0, dependencies: [], ...extra,
});

/** L'arbre aplati (discriminant) et les codes WBS (central), lus par le
 *  vrai store dans la page. */
async function numeroter(page, taches) {
    await page.goto('index.html');
    return page.evaluate(async (taches) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches.map(t => ({ ...t })),
        });
        const aplatir = (noeuds) => noeuds.flatMap(n => [n.id, ...aplatir(n.children || [])]);
        const arbre = aplatir(moteur.getTaskTree());
        if (typeof moteur.getWbs !== 'function') return { arbre, codes: {}, absent: 'store.getWbs absente' };
        const { codes, noeuds } = moteur.getWbs();
        return {
            arbre,
            codes: Object.fromEntries(codes),
            ordreNoeuds: noeuds.map(n => n.id),
            niveaux: Object.fromEntries(noeuds.map(n => [n.id, n.niveau])),
        };
    }, taches);
}

test('les codes WBS suivent l\'arbre du Gantt ; une tâche hors de l\'arbre n\'en a pas', async ({ page }) => {
    /* T1(0) ; C(1) enfant de la phase P(3) : P remonte au rang de C ;
       T2(2) ; ORPH, dont le parent a disparu ; L1 et L2, parents l'un de
       l'autre ; ORD(7), tâche ordinaire, parent de SOUS(8) ; E1 et E2 ex
       aequo à l'ordre 9, départagés par l'id (#140). */
    const r = await numeroter(page, [
        T('T1', 0), T('C', 1, { parentId: 'P' }), T('T2', 2), T('P', 3, { isPhase: true }),
        T('ORPH', 4, { parentId: 'DISPARU' }), T('L1', 5, { parentId: 'L2' }), T('L2', 6, { parentId: 'L1' }),
        T('ORD', 7), T('SOUS', 8, { parentId: 'ORD' }), T('E1', 9), T('E2', 9),
    ]);

    /* DISCRIMINANT — L'ARBRE EST CELUI QU'ON CROIT : P remontée avant T2,
       SOUS sous ORD, E1 avant E2, et ORPH, L1, L2 absents. Ferme « le jeu
       n'a pas l'arbre voulu » : un code faux viendrait alors du jeu, pas
       de la numérotation. */
    expect(r.arbre, 'l\'arbre de getTaskTree').toEqual(['T1', 'P', 'C', 'T2', 'ORD', 'SOUS', 'E1', 'E2']);

    // --- L'ASSERTION CENTRALE ---
    expect(r.codes, `les codes WBS${r.absent ? ` (${r.absent})` : ''}`).toEqual({
        T1: '1', P: '2', C: '2.1', T2: '3', ORD: '4', SOUS: '4.1', E1: '5', E2: '6',
    });
    /* Les nœuds suivent l'ordre des codes, avec leur niveau. */
    expect(r.ordreNoeuds, 'l\'ordre des nœuds').toEqual(r.arbre);
    expect(r.niveaux, 'les niveaux').toEqual({ T1: 1, P: 1, C: 2, T2: 1, ORD: 1, SOUS: 2, E1: 1, E2: 1 });
});

test('le rang compte à partir de 1, au-delà de 9 et sur trois niveaux', async ({ page }) => {
    /* A ⊃ A1…A11 ; B ⊃ B1 ⊃ B1a. */
    const enfantsA = Array.from({ length: 11 }, (_, i) => T(`A${i + 1}`, i + 1, { parentId: 'A' }));
    const r = await numeroter(page, [
        T('A', 0, { isPhase: true }), ...enfantsA,
        T('B', 20, { isPhase: true }), T('B1', 21, { isPhase: true, parentId: 'B' }), T('B1a', 22, { parentId: 'B1' }),
    ]);

    /* DISCRIMINANT — A10 et A11 suivent A9 dans l'arbre (ordre numérique
       des `order`, pas lexical). Ferme « l'arbre range déjà A10 avant A2 ». */
    expect(r.arbre, 'l\'arbre de getTaskTree').toEqual(['A', ...enfantsA.map(t => t.id), 'B', 'B1', 'B1a']);

    // --- L'ASSERTION CENTRALE ---
    expect(r.codes, `les codes WBS${r.absent ? ` (${r.absent})` : ''}`).toEqual({
        A: '1', ...Object.fromEntries(enfantsA.map((t, i) => [t.id, `1.${i + 1}`])),
        B: '2', B1: '2.1', B1a: '2.1.1',
    });
});
