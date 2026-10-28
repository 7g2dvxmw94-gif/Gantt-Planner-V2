import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle de l'échéance
 * du rapport DCMA 14 points (#84).
 *
 * LE DÉFAUT : une échéance posée un jour NON OUVRÉ perd un jour de retard.
 * L'écart signé entre la fin prévue et l'échéance se calculait
 *
 *     a < de  →  −(workingDaysBetween(a, de) − 1)
 *
 * Le « − 1 » retire la borne de départ en la supposant ouvrée. Quand
 * l'échéance est un samedi, un dimanche ou un férié, elle ne compte pas
 * dans workingDaysBetween, et le « − 1 » retire alors un jour qui n'y
 * était pas : un projet qui finit le lundi, avec une échéance le samedi
 * précédent, paraît à l'heure — marge nulle, point 7 conforme, CPLI à 1.
 * Le PAM 3.1.2.3 dit pourtant que « TF can be negative, which reflects
 * that the program is behind schedule ».
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur. Le champ « échéance » est un
 * <input type=date> : rien n'empêche d'y saisir un samedi.
 *
 * DEUX CAS, sur un même planning : A du lundi 18 au vendredi 22 janvier
 * 2027, puis B en Fin→Début du lundi 25 janvier au lundi 1er février. La
 * fin prévue est le lundi 1er février ; toute échéance du vendredi 29 au
 * dimanche 31 janvier met le projet en retard d'exactement un jour ouvré.
 *   - échéance le vendredi 29 (ouvré) : DISCRIMINANT, juste avant comme
 *     après — il établit que le calcul voit bien le retard d'un jour quand
 *     l'échéance est ouvrée ;
 *   - échéance le samedi 30 (non ouvré) : même retard, que seul le
 *     correctif voit.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — l'échéance du samedi. */

const T = (id, debut, fin, liens = []) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0 });
const PLANNING = [
    T('A', '2027-01-18', '2027-01-22'),
    T('B', '2027-01-25', '2027-02-01', [{ taskId: 'A', type: 'FS', lag: 0 }]),
];

async function evaluer(page, echeance) {
    return page.evaluate(async ({ taches, echeance }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat: '2027-01-18', echeance,
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        const p7 = r.points.find(p => p.n === 7), p13 = r.points.find(p => p.n === 13);
        return { samedi: !utils.isWorkingDay(echeance, cal), p7: { etat: p7.etat, fautives: p7.fautives },
                 p13: { etat: p13.etat, tf: p13.tf } };
    }, { taches: PLANNING, echeance });
}

test('DCMA : une échéance un jour non ouvré ne fait pas perdre de retard', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT — ÉCHÉANCE LE VENDREDI 29, OUVRÉ : le retard d'un jour
       est vu. Marge −1 pour A et B (point 7), TF −1 (CPLI). Passe avant
       comme après. */
    const vendredi = await evaluer(page, '2027-01-29');
    expect(vendredi, 'échéance le vendredi 29 janvier 2027').toEqual({
        samedi: false,
        p7: { etat: 'alerte', fautives: ['A', 'B'] },
        p13: { etat: 'alerte', tf: -1 },
    });

    // --- L'ASSERTION CENTRALE : même retard avec une échéance le samedi 30.
    const samedi = await evaluer(page, '2027-01-30');
    expect(samedi, 'échéance le samedi 30 janvier 2027').toEqual({
        samedi: true,
        p7: { etat: 'alerte', fautives: ['A', 'B'] },
        p13: { etat: 'alerte', tf: -1 },
    });
});
