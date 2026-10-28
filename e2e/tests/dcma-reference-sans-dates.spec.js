import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle de la
 * référence (baseline) dans le rapport DCMA 14 points.
 *
 * LE DÉFAUT : une entrée de référence SANS DATES est prise pour une
 * référence. Une référence capturée juste après un import Excel contient
 * les tâches que l'import n'a pas su dater, avec startDate et endDate à ''.
 * Le module les traite comme des dates :
 *   - point 8 (durée élevée) : « la durée de BASELINE quand elle existe ».
 *     dureeOuvree('', '') vaut 1 : une tâche de 99 jours ouvrés passe pour
 *     une tâche d'un jour, et sort de l'alerte ;
 *   - BEI (point 14) : la tâche n'est ni « échue » dans la référence — sa
 *     fin est vide — ni « absente » — elle y a une entrée. Elle sort donc
 *     du dénominateur, alors que le PAM 3.1.2.4 dit : « Tasks missing
 *     baseline finish dates are included in the denominator ».
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * LE PLANNING, celui du constat. Date d'état : 1er septembre 2026.
 *   A  1er au 30 juin, terminée ;
 *   B  8 juin au 23 octobre, non commencée — 99 jours ouvrés ;
 *   C  17 au 31 août, à moitié faite.
 * Référence : A et C à leurs dates ; B, selon le cas, absente ou présente
 * avec des dates vides. Une entrée sans dates n'apporte aucune date : les
 * deux cas doivent donner le même rapport.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « B dans la référence, dates vides ». */

const T = (id, debut, fin, progress) => ({ id, name: id, startDate: debut, endDate: fin, dependencies: [], progress });
const TACHES = [
    T('A', '2026-06-01', '2026-06-30', 100),
    T('B', '2026-06-08', '2026-10-23', 0),
    T('C', '2026-08-17', '2026-08-31', 50),
];
const REF = (b) => ({ tasks: [
    { id: 'A', startDate: '2026-06-01', endDate: '2026-06-30' },
    ...(b ? [b] : []),
    { id: 'C', startDate: '2026-08-17', endDate: '2026-08-31' },
] });

async function evaluer(page, baseline) {
    return page.evaluate(async ({ taches, baseline }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat: '2026-09-01', baseline,
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        const p = (n) => r.points.find(x => x.n === n);
        return {
            dureeB: utils.workingDaysBetween('2026-06-08', '2026-10-23', cal),
            p8: { etat: p(8).etat, rapport: `${p(8).numerateur}/${p(8).denominateur}`, fautives: p(8).fautives },
            bei: { etat: p(14).etat, rapport: `${p(14).numerateur}/${p(14).denominateur}` },
        };
    }, { taches: TACHES, baseline });
}

test('DCMA : une entrée de référence sans dates compte comme une tâche sans référence', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT 1 — B ABSENTE DE LA RÉFÉRENCE. Sa durée courante, 99 jours
       ouvrés, la met en alerte au point 8 (1 sur 2 : A, terminée, est hors
       population) ; et elle entre au dénominateur du BEI avec A et C,
       échues dans la référence : 1 terminée sur 3. Sans ce point, l'égalité
       centrale pourrait comparer deux rapports également faux. Passe avant
       comme après. */
    const absente = await evaluer(page, REF(null));
    expect(absente, 'B absente de la référence').toEqual({
        dureeB: 99,
        p8: { etat: 'alerte', rapport: '1/2', fautives: ['B'] },
        bei: { etat: 'alerte', rapport: '1/3' },
    });

    /* DISCRIMINANT 2 — UNE RÉFÉRENCE DATÉE EST BIEN LUE. B y figure du 8 au
       12 juin : 5 jours ouvrés de référence, sous le seuil, alors que sa
       durée courante est de 99. Le point 8 la tient pour conforme. Sans ce
       point, un correctif qui cesserait de lire la référence au point 8
       ferait passer l'assertion centrale, puisque les deux cas y prendraient
       alors la durée courante. Passe avant comme après. */
    const datee = await evaluer(page, REF({ id: 'B', startDate: '2026-06-08', endDate: '2026-06-12' }));
    expect(datee.p8, 'B dans la référence, du 8 au 12 juin').toEqual({ etat: 'ok', rapport: '0/2', fautives: [] });

    // --- L'ASSERTION CENTRALE : une entrée sans dates n'apporte rien.
    const vide = await evaluer(page, REF({ id: 'B', startDate: '', endDate: '' }));
    expect(vide, 'B dans la référence, dates vides').toEqual(absente);
});
