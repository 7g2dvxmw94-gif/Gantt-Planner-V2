import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (rapport DCMA) sous l'angle des DATES RÉELLES :
 * les points 9 (dates invalides), 11 (tâches manquées) et 14 (BEI) les
 * lisent, et ne se disent plus « approchés » quand elles existent.
 *
 * LE BESOIN. Sans dates réelles, dcma.js faisait tenir l'avancement lieu
 * de date réelle : une tâche à 0 % était « non commencée », à 100 %
 * « finie à sa date de fin ». D'où, au point 9, une tâche COMMENCÉE le
 * 01/06 (Début réel posé dans la fiche) mais encore à 0 % comptée comme
 * « début prévu dans le passé » — une date invalide qu'elle n'a pas. Et la
 * mention « approché : l'avancement tient lieu de dates réelles » restait,
 * même quand chaque tâche porte ses réels.
 *
 * LA RÈGLE. Une tâche qui a un Début réel est commencée, à cette date ; une
 * Fin réelle est sa fin. Point 9 : un réel après la date d'état est
 * invalide ; un début PRÉVU avant elle, pour une tâche non commencée, aussi.
 * Points 11 et 14 : une Fin réelle est la fin de la tâche, et la compte
 * comme faite. La mention « approché » ne reste que si une tâche s'en
 * remet encore à l'avancement : avancement > 0 sans Début réel, ou 100 %
 * sans Fin réelle.
 *
 * LE MODULE EST PUR (dcma.js) : ce test lui passe tout, avec le vrai
 * moteur (analyzeNetwork, computeConstrainedDatesIn), comme
 * dcma-calcul.spec.js. Rien n'est écrit en base. Date d'état fixée au lundi
 * 15/06/2026, source « projet » (aucune mention « aujourd'hui »).
 *
 * LE PLANNING « RÉEL » (toutes les tâches avancées portent leurs réels) :
 *   X  01 → 19/06, 0 %, Début réel 01/06 — commencée : date VALIDE ;
 *   Y  01 → 19/06, 0 %, sans réel — début prévu passé : INVALIDE ;
 *   W  22 → 26/06, 30 %, Début réel 22/06 — réel futur : INVALIDE ;
 *   U  08 → 19/06, 40 %, Début réel 08/06 — valide ;
 *   V  16 → 19/06, 0 %, sans réel — valide ;
 *   D  01 → 05/06, 100 %, réel 01 → 05 — finie.
 * Référence : chaque tâche à ses dates. LE PLANNING « APPROCHÉ » y ajoute
 * T (08 → 19/06, 50 %, sans réel : début approché) et D2 (01 → 05/06,
 * 100 %, commencée le 01 mais SANS FIN RÉELLE : fin approchée). Au point
 * 11, seule D2 est échue : sa mention ne tient qu'à la fin approchée.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : point 9, fautives « W, X, Y » au lieu de « W, Y ». Les
 * discriminants — le planning approché garde sa mention aux points 9, 11
 * et 14, et compte Y et W — passent. */

const DATE_ETAT = '2026-06-15';
const T = (id, debut, fin, extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: [], progress: 0, ...extra });

const REEL = [
    T('X', '2026-06-01', '2026-06-19', { actualStart: '2026-06-01' }),
    T('Y', '2026-06-01', '2026-06-19'),
    T('W', '2026-06-22', '2026-06-26', { progress: 30, actualStart: '2026-06-22' }),
    T('U', '2026-06-08', '2026-06-19', { progress: 40, actualStart: '2026-06-08' }),
    T('V', '2026-06-16', '2026-06-19'),
    T('D', '2026-06-01', '2026-06-05', { progress: 100, actualStart: '2026-06-01', actualFinish: '2026-06-05' }),
];
const APPROCHE = [
    ...REEL,
    T('T', '2026-06-08', '2026-06-19', { progress: 50 }),
    T('D2', '2026-06-01', '2026-06-05', { progress: 100, actualStart: '2026-06-01' }),
];
const baseline = (taches) => ({ tasks: taches.map(t => ({ id: t.id, startDate: t.startDate, endDate: t.endDate })) });

/** Rend, pour les points 9, 11 et 14 : fautives triées et mention
 *  « sans-dates-reelles » présente ou non. */
async function evaluer(page, taches) {
    return page.evaluate(async ({ taches, dateEtat, bl }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const dcma = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = dcma.evaluerDcma({
            taches, calendrier: cal, dateEtat, sourceDateEtat: 'projet', baseline: bl,
            analyse: moteur.analyzeNetwork(),
            placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
        });
        const p = (n) => r.points.find(x => x.n === n);
        const ouvres = Object.fromEntries(['2026-06-01', '2026-06-15', '2026-06-22'].map(d => [d, utils.isWorkingDay(d, cal)]));
        return {
            ouvres,
            fautives9: [...p(9).fautives].sort().join(', '),
            approche: Object.fromEntries([9, 11, 14].map(n => [n, (p(n).approche || []).includes('sans-dates-reelles')])),
        };
    }, { taches, dateEtat: DATE_ETAT, bl: baseline(taches) });
}

test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
});

test('DCMA : les dates réelles rendent exacts les points 9, 11 et 14', async ({ page }) => {
    /* DISCRIMINANT — LE PLANNING APPROCHÉ GARDE SA MENTION aux trois
       points (T avancée sans Début réel, D2 finie sans Fin réelle — au
       point 11, D2 seule, par sa fin), et le
       point 9 y compte bien Y (début prévu passé) et W (réel futur). Ferme
       « la mention a disparu partout » et « le point 9 ne compte plus
       rien ». Passe avant comme après. */
    const approche = await evaluer(page, APPROCHE);
    expect(approche.ouvres, 'le calendrier par défaut est lundi-vendredi').toEqual({ '2026-06-01': true, '2026-06-15': true, '2026-06-22': true });
    expect(approche.approche, 'le planning approché garde sa mention').toEqual({ 9: true, 11: true, 14: true });
    expect(approche.fautives9, 'Y et W comptées au point 9').toContain('W');
    expect(approche.fautives9, 'Y et W comptées au point 9').toContain('Y');

    // --- L'ASSERTION CENTRALE ---
    const reel = await evaluer(page, REEL);
    expect(reel.fautives9, 'point 9 : X, commencée le 01/06, n\'a pas de date invalide').toBe('W, Y');
    expect(reel.approche, 'toutes les tâches portent leurs réels : plus de mention « approché »').toEqual({ 9: false, 11: false, 14: false });
});
