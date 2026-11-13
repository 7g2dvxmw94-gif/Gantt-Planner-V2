import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sixième angle après
 * critical-path.spec.js, chemin-critique-liens.spec.js,
 * chemin-critique-ancrage.spec.js, chemin-critique-jours-ouvres.spec.js et
 * chemin-critique-tache-sans-dates.spec.js : une tâche à marge NÉGATIVE.
 *
 * LE DÉFAUT : analyzeNetwork() ne retient au chemin critique que les tâches
 * dont la marge est NULLE, à la tolérance près :
 *
 *     if (Math.abs(float) < 0.001) {
 *         critical.push(t.id);
 *
 * Une tâche dont la marge est négative en sort. Or une marge négative dit
 * que la tâche est déjà en retard sur ce que ses successeurs exigent :
 * elle est plus que critique, pas hors du chemin. La règle de MS Project
 * et de P6 est « critique si marge ≤ 0 ».
 *
 * UNE MARGE NÉGATIVE N'A RIEN D'EXOTIQUE. Il suffit d'un lien qui n'est pas
 * tenu : B, Fin→Début de A, posée le jour même où A finit. C'est ce que
 * laisse un import qui perd un décalage négatif, ou l'écriture d'un client
 * qui n'a pas replacé la tâche. Les contraintes de date, qui arrivent, en
 * feront un cas courant : une contrainte tenue contre un lien.
 *
 * CONSÉQUENCES MESURÉES sur main (a3d3cdf), harnais hors CI : le chemin
 * critique surligné (A n'a pas la classe critical-path, le message dit
 * « 1 tâches sur 2 ») et le point 12 du rapport DCMA, qui ne choisit sa
 * tâche à retarder que parmi les critiques (« aucune tâche critique
 * incomplète reliée à un successeur » ici, alors que A en a un).
 *
 * LE MOTEUR est le vrai store, chargé dans la page, appliqué à ces tâches.
 * Le test ne place rien : il lit le planning tel qu'il est posé.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « chemin critique », reçu ["B"]. */

const T = (id, debut, fin, preds = []) => ({
    id, name: id, startDate: debut, endDate: fin, progress: 0,
    dependencies: preds.map(p => ({ taskId: p, type: 'FS', lag: 0 })),
});

/** Juin 2026 commence un lundi. A occupe la semaine du 1er au 5 ; B,
 *  Fin→Début de A, devrait commencer le lundi 8 et est posée le vendredi 5,
 *  jusqu'au mardi 9 : le lien n'est pas tenu, d'un jour ouvré. */
const ROMPU = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-05', '2026-06-09', ['A']),
];
/** Une chaîne saine, A' → B' sur deux semaines pleines, et E', courte et
 *  libre, qui finit huit jours ouvrés avant le projet. */
const SAIN = [
    T("A'", '2026-06-01', '2026-06-05'),
    T("B'", '2026-06-08', '2026-06-12', ["A'"]),
    T("E'", '2026-06-01', '2026-06-02'),
];

async function analyser(page, taches) {
    return page.evaluate(async ({ taches }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const analyse = moteur.analyzeNetwork();
        return {
            critiques: [...moteur.getCriticalPath()].sort(),
            marges: analyse.float,
        };
    }, { taches });
}

test('une tâche à marge négative est sur le chemin critique', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const rompu = await analyser(page, ROMPU);
    const sain  = await analyser(page, SAIN);

    /* DISCRIMINANT 1 — LE RÉSEAU A LA MARGE NÉGATIVE QU'ON CROIT : A à −1
       jour ouvré, B à 0. Sans ce point, un rouge pourrait venir d'un réseau
       où A a en fait de la marge (dates mal lues, lien ignoré), et le test
       accuserait la règle de sélection d'un défaut qu'elle n'a pas. Passe
       avant comme après : le correctif ne touche pas au calcul des marges. */
    expect(rompu.marges, 'marges du réseau rompu').toEqual({ A: -1, B: 0 });

    /* DISCRIMINANT 2 — LE CHEMIN CRITIQUE NE DEVIENT PAS TOUT LE PROJET.
       Dans une chaîne saine, A' et B' sont critiques (marge 0) et E', qui a
       huit jours ouvrés de marge, ne l'est pas. Sans ce point, un correctif
       qui rendrait toute tâche critique ferait passer l'assertion
       centrale. Passe avant comme après. */
    expect(sain, 'réseau sain').toEqual({
        critiques: ["A'", "B'"],
        marges: { "A'": 0, "B'": 0, "E'": 8 },
    });

    // --- L'ASSERTION CENTRALE : A, à marge négative, est critique, comme B.
    expect(rompu.critiques, 'chemin critique').toEqual(['A', 'B']);
});
