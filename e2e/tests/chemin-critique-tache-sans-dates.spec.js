import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), cinquième angle après
 * critical-path.spec.js, chemin-critique-liens.spec.js,
 * chemin-critique-ancrage.spec.js et chemin-critique-jours-ouvres.spec.js :
 * une tâche SANS DATES dans le projet.
 *
 * LE DÉFAUT : une seule tâche sans dates fausse la marge de TOUT le
 * réseau. analyzeNetwork() prend pour origine la date de début la plus
 * précoce :
 *
 *     const origine = tasks.reduce(
 *         (mini, t) => (mini === null || t.startDate < mini) ? t.startDate : mini, null);
 *
 * La chaîne vide précède toute date ISO : une tâche dont startDate vaut ''
 * devient l'origine. workingDaysBetween('', date) vaut alors 0, rang()
 * rend 0 pour TOUTES les dates, et chaque tâche est réputée commencer au
 * même instant. La fin du projet tombe à la plus longue durée isolée, et
 * les marges perdent tout sens.
 *
 * UNE TÂCHE SANS DATES N'A RIEN D'EXOTIQUE. La base admet start_date et
 * end_date nulles (migration 001), et rowToTask les rend en '' ; l'import
 * Excel ajoute la ligne avec '' quand la date est illisible.
 *
 * CONSÉQUENCES MESURÉES : le chemin critique surligné (getCriticalPath),
 * et les points 6, 7 et 12 du rapport DCMA, qui lisent ces marges.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur. Le défaut précède le DCMA : il était
 * déjà dans getCriticalPath().
 *
 * LE PLANNING, celui du constat : A → B → C → D en Fin→Début, de juin à
 * décembre 2026, qui porte la fin du projet ; une branche courte A → S → F
 * en juin ; et X, sans dates ni liens. Le moteur est le vrai store, chargé
 * dans la page, appliqué à ces tâches.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « réseau avec X ». */

const T = (id, debut, fin, preds = []) => ({
    id, name: id, startDate: debut, endDate: fin, progress: 0,
    dependencies: preds.map(p => ({ taskId: p, type: 'FS', lag: 0 })),
});
const DATES = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-08', '2026-08-28', ['A']),
    T('C', '2026-08-31', '2026-11-27', ['B']),
    T('D', '2026-11-30', '2026-12-04', ['C']),
    T('S', '2026-06-08', '2026-06-12', ['A']),
    T('F', '2026-06-15', '2026-06-19', ['S']),
];
const X = T('X', '', '');
const DATEES = DATES.map(t => t.id);
/* Aucune date de début valide dans tout le projet : P puis Q, en Fin→Début,
   chacune avec sa seule date de fin. */
const SANS_DEBUT = [T('P', '', '2026-06-05'), T('Q', '', '2026-06-12', ['P'])];

async function analyser(page, taches, ids = DATEES) {
    return page.evaluate(async ({ taches, datees }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const analyse = moteur.analyzeNetwork();
        return {
            critiques: moteur.getCriticalPath().filter(id => datees.includes(id)).sort(),
            marges: Object.fromEntries(datees.map(id => [id, analyse.float[id]])),
            analysees: Object.keys(analyse.float).sort(),
        };
    }, { taches, datees: ids });
}

test('une tâche sans dates ne fausse pas la marge des autres', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const sans = await analyser(page, DATES);
    const avec = await analyser(page, [...DATES, X]);

    /* DISCRIMINANT 1 — SANS X, LE RÉSEAU EST CELUI QU'ON CROIT : A, B, C, D
       critiques, et la branche courte S → F a 118 jours ouvrés de marge
       jusqu'au 4 décembre. Sans ce point, l'égalité centrale pourrait
       comparer deux résultats également faux. Passe avant comme après. */
    expect(sans, 'réseau sans X').toEqual({
        critiques: ['A', 'B', 'C', 'D'],
        marges: { A: 0, B: 0, C: 0, D: 0, S: 118, F: 118 },
        analysees: ['A', 'B', 'C', 'D', 'F', 'S'],
    });

    /* DISCRIMINANT 2 — X ENTRE BIEN DANS L'ANALYSE. Sans ce point, un vert
       pourrait venir de ce que X a été écartée avant d'atteindre le moteur,
       et le test ne mesurerait plus rien. Passe avant comme après. */
    expect(avec.analysees, 'tâches analysées avec X').toEqual(['A', 'B', 'C', 'D', 'F', 'S', 'X']);

    /* DISCRIMINANT 3 — SANS AUCUNE DATE DE DÉBUT VALIDE, LES MARGES RESTENT
       NULLES. Le réseau n'a alors rien à mesurer. Sans ce point, un
       correctif qui écarte les dates invalides de l'origine pourrait la
       laisser vide, et null se lit comme le 1er janvier 1970 : une marge
       négative de plusieurs milliers de jours apparaîtrait. Passe avant
       comme après. */
    expect(await analyser(page, SANS_DEBUT, ['P', 'Q']), 'réseau sans aucune date de début').toEqual({
        critiques: ['P', 'Q'],
        marges: { P: 0, Q: 0 },
        analysees: ['P', 'Q'],
    });

    // --- L'ASSERTION CENTRALE : X ne change rien aux tâches datées.
    expect({ critiques: avec.critiques, marges: avec.marges }, 'réseau avec X')
        .toEqual({ critiques: sans.critiques, marges: sans.marges });
});
