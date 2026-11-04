import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E1 (niveaux de zoom), sous l'angle de l'étendue
 * de la frise : une tâche SANS DATES dans le projet.
 *
 * LE DÉFAUT : une seule tâche sans dates fait disparaître toute la frise.
 * getTimelineRange() calcule les bornes par :
 *
 *     const starts = tasks.map(t => parseISO(t.startDate).getTime());
 *     const ends = tasks.map(t => parseISO(t.endDate).getTime());
 *     const minDate = new Date(Math.min(...starts));
 *     const maxDate = new Date(Math.max(...ends));
 *
 * parseISO('') est une date invalide, dont getTime() vaut NaN, et
 * Math.min / Math.max propagent NaN. Une seule date illisible suffit : la
 * borne correspondante part en « Invalid Date », à TOUS les niveaux de
 * zoom, puisqu'elle est calculée avant le choix du zoom.
 *
 * UNE TÂCHE SANS DATES N'A RIEN D'EXOTIQUE. La base admet start_date et
 * end_date nulles (migration 001), et rowToTask les rend en '' ; l'import
 * Excel met '' pour une date illisible, colonne par colonne — d'où aussi
 * des tâches à moitié datées.
 *
 * MÊME FORME QUE #91, où une tâche sans dates devenait l'origine
 * d'analyzeNetwork(). Seules les dates VALIDES doivent concourir.
 *
 * ET TOUTES LES DATES VALIDES CONCOURENT, celles des tâches à moitié
 * datées comprises. Les deux bornes se prennent sur l'ensemble des débuts
 * et des fins lisibles. Les prendre côté par côté — plus petit début
 * valide, plus grande fin valide — laisserait hors de la frise un début
 * seul postérieur à toutes les fins, et inverserait la plage quand un
 * début seul suit une fin seule : mesuré, du 3 juillet au 19 juin en
 * semaine, 0 colonne — le symptôme même du défaut.
 *
 * CONSÉQUENCES MESURÉES dans la page, sur le texte réel des modules, avec
 * A du 1er au 5 juin 2026 et X sans dates :
 *   - A seule, zoom « semaine » : du 25 mai au 19 juin 2026 ; avec X, les
 *     deux bornes valent « Invalid Date », aux cinq appels mesurés plus
 *     bas (jour, semaine, mois, trimestre, et sans argument) ;
 *   - getDaysBetween() et getMonthsBetween() rendent alors 0 colonne et
 *     0 mois (26 jours et 2 mois pour A seule, en semaine) : la largeur
 *     de la frise, produit de ce nombre par la largeur de colonne dans
 *     gantt-renderer.js, tombe à zéro ;
 *   - formatDateISO() de ces bornes, qui sert de période par défaut à la
 *     fenêtre d'export PDF quand le projet n'a pas de dates, rend
 *     « NaN-NaN-NaN ».
 *
 * LE MOTEUR EST LE VRAI STORE, chargé dans la page : son prototype, avec
 * getTasks() rendu par le test. getTimelineRange() ne lit rien d'autre de
 * l'instance ; si elle se mettait à lire autre chose, l'appel lèverait, et
 * le premier discriminant tomberait au lieu de mentir.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « frise avec des dates illisibles ». */

const T = (id, debut, fin) => ({ id, name: id, startDate: debut, endDate: fin, progress: 0, dependencies: [] });
const A = T('A', '2026-06-01', '2026-06-05');
/* X : aucune date, comme rowToTask la rend d'une ligne aux dates nulles. */
const X = T('X', '', '');
/* Y : le début est lisible, pas la fin — l'import Excel traite chaque
   colonne à part. Son début tombe DANS la plage de A : A + Y ne regarde
   que la fin illisible. */
const Y = T('Y', '2026-06-03', '');
/* Z et D : à moitié datées, et placées pour que leur date lisible
   DÉPLACE une borne. Z n'a que son début, le 10 juillet, après toutes les
   fins ; D n'a que sa fin, le 5 juin, avant le début de Z. */
const Z = T('Z', '2026-07-10', '');
const D = T('D', '', '2026-06-05');
/* J et E : les mêmes dates lisibles, portées par des tâches entièrement
   datées. A + Z doit borner comme A + J, et D + Z comme E. */
const J = T('J', '2026-07-10', '2026-07-10');
const E = T('E', '2026-06-05', '2026-07-10');

/* Les cinq appels de l'application : les quatre zooms de gantt-renderer.js,
   et l'appel sans argument de js/app.js (glisser-déposer, export PDF). */
const ZOOMS = ['day', 'week', 'month', 'quarter', undefined];

/* Rend, pour chaque appel, « début → fin » en composantes LOCALES
   (formatDateISO), indépendamment du fuseau du navigateur. Une borne
   invalide s'écrit « Invalid Date », comme String(date) la nomme. */
async function plages(page, jeux) {
    return page.evaluate(async ({ jeux, zooms }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const ecrire = (d) => isNaN(d.getTime()) ? String(d) : utils.formatDateISO(d);
        const sortie = {};
        for (const [nom, taches] of Object.entries(jeux)) {
            const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
                getTasks: () => taches,
            });
            sortie[nom] = {};
            for (const z of zooms) {
                const p = moteur.getTimelineRange(z);
                sortie[nom][z ?? 'sans zoom'] = `${ecrire(p.start)} → ${ecrire(p.end)}`;
            }
        }
        return sortie;
    }, { jeux, zooms: ZOOMS });
}

test('une tâche sans dates ne fait pas disparaître la frise', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* Tous les jeux dans UN appel : le repli « aucune tâche » lit l'horloge,
       et le comparer d'un appel à l'autre ouvrirait une fenêtre sur minuit. */
    const r = await plages(page, {
        a: [A], ax: [A, X], ay: [A, Y], x: [X], vide: [],
        az: [A, Z], aj: [A, J], dz: [D, Z], e: [E],
    });

    /* DISCRIMINANT 1 — A SEULE, LA PLAGE EST CELLE QU'ON CROIT, à chaque
       zoom : sept jours avant, quatorze après, en jour et en semaine comme
       sans argument ; calée sur le mois en « mois », sur le trimestre en
       « trimestre ». Sans ce point, l'égalité centrale pourrait comparer
       deux plages également fausses — deux « Invalid Date », ou un
       correctif qui rendrait le repli pour tout projet. Passe avant comme
       après. */
    expect(r.a, 'frise de A seule').toEqual({
        day: '2026-05-25 → 2026-06-19',
        week: '2026-05-25 → 2026-06-19',
        month: '2026-06-01 → 2026-06-30',
        quarter: '2026-04-01 → 2026-06-30',
        'sans zoom': '2026-05-25 → 2026-06-19',
    });

    /* DISCRIMINANT 2 — LE REPLI « AUCUNE TÂCHE » REND DEUX DATES VALIDES,
       à chaque appel. L'assertion centrale attend ce repli pour X seule ;
       sans ce point, elle pourrait comparer deux « Invalid Date » et passer.
       La valeur exacte dépend du jour où le test tourne : seule la forme
       est exigée. Passe avant comme après. */
    for (const [zoom, plage] of Object.entries(r.vide)) {
        expect(plage, `repli sans tâche, ${zoom}`).toMatch(/^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/);
    }

    /* DISCRIMINANT 3 — LES ÉQUIVALENTS ENTIÈREMENT DATÉS DONNENT LA PLAGE
       QU'ON CROIT : mêmes règles qu'au discriminant 1, sur les bornes du
       1er juin et du 10 juillet pour A + J, du 5 juin et du 10 juillet
       pour E. L'assertion centrale compare A + Z à A + J, et D + Z à E ;
       sans ce point, la date du 10 juillet pourrait être perdue des DEUX
       côtés, et l'égalité laisserait passer une frise qui s'arrête le
       19 juin, Z dehors. Passe avant comme après. */
    expect({ 'A + J': r.aj, E: r.e }, 'frise des équivalents datés').toEqual({
        'A + J': {
            day: '2026-05-25 → 2026-07-24',
            week: '2026-05-25 → 2026-07-24',
            month: '2026-06-01 → 2026-07-31',
            quarter: '2026-04-01 → 2026-09-30',
            'sans zoom': '2026-05-25 → 2026-07-24',
        },
        E: {
            day: '2026-05-29 → 2026-07-24',
            week: '2026-05-29 → 2026-07-24',
            month: '2026-06-01 → 2026-07-31',
            quarter: '2026-04-01 → 2026-09-30',
            'sans zoom': '2026-05-29 → 2026-07-24',
        },
    });

    /* --- L'ASSERTION CENTRALE : une date illisible ne compte pas, une
       date lisible compte, qu'elle soit un début ou une fin. */
    expect({ 'A + X': r.ax, 'A + Y': r.ay, 'A + Z': r.az, 'D + Z': r.dz, 'X seule': r.x },
        'frise avec des dates illisibles')
        .toEqual({ 'A + X': r.a, 'A + Y': r.a, 'A + Z': r.aj, 'D + Z': r.e, 'X seule': r.vide });
});
