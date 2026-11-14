import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (rapport DCMA) : le point 5 compte les
 * contraintes de date DURES, jalons compris.
 *
 * LE BESOIN. Le point 5 du DCMA (« Hard constraints », seuil 5 %) répond
 * « sans objet : l'application ne gère pas de contraintes de date ». C'est
 * faux depuis #113 : une tâche porte une contrainte, et quatre types sont
 * dures (« Début au plus tard le », « Fin au plus tard le », « Doit
 * commencer le », « Doit finir le »). La décision de l'utilisateur : le
 * point 5 compte AUSSI les jalons contraints, car un jalon « Doit finir
 * le » est l'usage le plus courant d'une contrainte dure.
 *
 * LE JEU (test pur, le vrai moteur et le vrai module, rien en base) :
 *   T1 → T2 → … → T20, vingt tâches incomplètes enchaînées Fin→Début ;
 *     T5 et T10 « Doit commencer le » (MSO), T15 « Début au plus tôt le »
 *     (SNET, souple) ;
 *   F  « Fin au plus tard le » (FNLT), TERMINÉE : hors population ;
 *   J1 jalon « Doit finir le » (MFO) ; J2 jalon sans contrainte.
 *
 * L'ATTENDU. Population du point 5 : 20 tâches + 2 jalons incomplets = 22.
 * Fautives : T5, T10 et J1 ; 3/22 = 13,6 %, au-dessus du seuil de 5 % :
 * alerte.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed ici, sur le point 5, qui
 * reçoit « 5:—:sans-objet ». (Les cinq lignes « 5:—:sans-objet » de
 * dcma-calcul.spec.js, celle de dcma-echeance-contraintes.spec.js et
 * dcma-rapport.spec.js:109, modifiées dans le même commit, échouent
 * aussi, chacune sur son point 5.) JUIN 2026 COMMENCE UN LUNDI. */

const DATE_ETAT = '2026-06-15';

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });

/** Évalue le module dans la page. Les témoins sont mesurés AVANT l'import
 *  du module : ils existent avant comme après la fonctionnalité. */
async function evaluer(page, taches, extra = {}) {
    return page.evaluate(async ({ taches, extra, dateEtat }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches,
            getTask: (id) => taches.find(t => t.id === id),
            _getCalendar: () => cal,
        });
        const temoins = {
            critique: moteur.getCriticalPath(),
            placements: Object.fromEntries(taches.filter(t => (t.dependencies || []).length)
                .map(t => [t.id, moteur._computeConstrainedDates(t)])),
            joursOuvresJuinJuillet: utils.workingDaysBetween('2026-06-01', '2026-07-31', cal),
        };
        let dcma;
        try {
            dcma = await import(new URL('js/dcma.js', base).href);
        } catch (e) {
            return { temoins, absent: String((e && e.message) || e) };
        }
        const rapport = dcma.evaluerDcma({
            taches, calendrier: cal, dateEtat, ...extra,
            analyse: moteur.analyzeNetwork(),
            placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
        });
        return { temoins, rapport };
    }, { taches, extra, dateEtat: DATE_ETAT });
}

/** Le tableau des 14 points en une ligne : n°, valeur, état. */
const tableau = (r) => r.rapport
    ? r.rapport.points.map(p => `${p.n}:${p.valeur === null ? '—' : p.valeur}:${p.etat}`).join(' ')
    : `module DCMA absent — ${r.absent}`;
const fautives = (r, n) => r.rapport.points.find(p => p.n === n).fautives;

test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
});

/** Les jours ouvrés de juin 2026, du lundi 01 au mardi 30 (22 jours). */
const JOURS = [];
for (let d = 1; d <= 30; d++) {
    const iso = `2026-06-${String(d).padStart(2, '0')}`;
    const jour = new Date(2026, 5, d).getDay();
    if (jour !== 0 && jour !== 6) JOURS.push(iso);
}

test('DCMA, point 5 : les contraintes dures sont comptées, jalons compris', async ({ page }) => {
    const taches = [];
    for (let i = 1; i <= 20; i++) {
        const extra = i === 5 || i === 10 ? { constraintType: 'MSO', constraintDate: JOURS[i - 1] }
                    : i === 15 ? { constraintType: 'SNET', constraintDate: JOURS[i - 1] } : {};
        taches.push(T(`T${i}`, JOURS[i - 1], JOURS[i - 1], i > 1 ? [L(`T${i - 1}`)] : [], extra));
    }
    taches.push(T('F', '2026-06-01', '2026-06-05', [], { progress: 100, constraintType: 'FNLT', constraintDate: '2026-06-05' }));
    taches.push(T('J1', '2026-06-30', '2026-06-30', [], { isMilestone: true, constraintType: 'MFO', constraintDate: '2026-06-30' }));
    taches.push(T('J2', '2026-06-30', '2026-06-30', [], { isMilestone: true }));

    const r = await evaluer(page, taches);
    const ligne = (n) => {
        const p = r.rapport.points.find(x => x.n === n);
        return `${n}:${p.valeur === null ? '—' : p.valeur}:${p.etat} /${p.denominateur} [${p.fautives.join(',')}]`;
    };

    /* DISCRIMINANT — LE CALENDRIER : juin 2026 a 22 jours ouvrés, et la
       chaîne T1 → T20 en occupe vingt. Ferme « les dates du jeu tombent un
       week-end ». */
    expect(JOURS.length, 'jours ouvrés de juin 2026').toBe(22);

    /* DISCRIMINANT D1 — LES POINTS 1 À 4 NE COMPTENT PAS LES JALONS.
       Ferme « les jalons sont entrés dans la population de tous les
       points » : la population du point 5 change, pas celle des autres. */
    expect([1, 2, 3, 4].map(ligne).join(' | '), 'points 1 à 4 inchangés').toBe(
        '1:10:alerte /20 [T1,T20] | 2:0:ok /19 [] | 3:0:ok /19 [] | 4:100:ok /19 []');

    // --- L'ASSERTION CENTRALE ---
    expect(ligne(5), 'point 5 : contraintes dures, jalons compris')
        .toBe('5:13.6:alerte /22 [T5,T10,J1]');
});
