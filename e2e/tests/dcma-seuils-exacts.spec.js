import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';
import { addWorkingDays, formatDateISO, defaultCalendar } from '../../js/utils.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle des seuils du
 * rapport DCMA 14 points.
 *
 * LE DÉFAUT : l'état était calculé sur la valeur ARRONDIE. js/dcma.js
 * arrondissait chaque mesure — au dixième de pourcent, au centième pour
 * les ratios — puis la comparait au seuil. Une mesure juste du mauvais
 * côté, mais qui s'arrondit sur le seuil, était déclarée conforme :
 *   - point 1, 6 tâches sans logique sur 119 = 5,04 %  → « 5 % », conforme,
 *     alors que le PAM 4.1 dit « an excess of 5% should be considered a flag » ;
 *   - point 3, 6 décalages positifs sur 119 liens = 5,04 % → « 5 % »,
 *     conforme, alors que « the number relationships with lags should not
 *     exceed 5% » (PAM 4.3) ;
 *   - point 4, 224 liens Fin→Début sur 249 = 89,96 %  → « 90 % », conforme,
 *     alors qu'il en faut « at least 90% » (PAM 4.4) ;
 *   - BEI, 18 tâches finies sur 19 = 0,947             → « 0,95 », conforme,
 *     alors que « a BEI less than 0.95 should be considered a flag » ;
 *   - CPLI, (39 − 2) / 39 = 0,949                      → « 0,95 », conforme,
 *     même règle (PAM 3.1.2.3).
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * Les points 2 et 7, de seuil 0, partagent le défaut mais n'y basculent
 * qu'au-delà de 2 000 liens ou tâches (une sur 2 001 s'arrondit à 0 %) :
 * trop lourd pour la CI. Ils passent par les chemins de code d'autres
 * points mesurés ici : le point 7 par pointPourcent(), comme le point 1 ;
 * le point 2 par le bloc qu'il partage avec le point 3.
 *
 * DEUX TÉMOINS SONT POSÉS EXACTEMENT SUR LE SEUIL — 5 % de tâches sans
 * logique, un BEI de 0,95 — et doivent rester conformes : le PAM dit « an
 * excess of 5% » et « less than 0.95 ». Ils ferment une autre façon de
 * passer l'assertion centrale : rendre la comparaison stricte.
 *
 * Les plannings sont GÉNÉRÉS ici, avec les fonctions de calendrier du
 * dépôt : chaque tâche occupe un jour ouvré, chaque lien Fin→Début colle
 * le successeur au lendemain ouvré de son prédécesseur.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — les cinq états, « ok » au lieu de « alerte ». */

const CAL = defaultCalendar();
const DEBUT = '2026-06-01';   // un lundi
const jour = (i) => formatDateISO(addWorkingDays(DEBUT, i, CAL));
const T = (id, i, liens = [], extra = {}) =>
    ({ id, name: id, startDate: jour(i), endDate: jour(i), dependencies: liens, progress: 0, ...extra });

/** Une chaîne de n tâches, chacune le jour ouvré suivant la précédente. */
function chaine(prefixe, n, typeLien = () => 'FS', decalage = () => 0) {
    return Array.from({ length: n }, (_, i) =>
        T(`${prefixe}${i}`, i, i ? [{ taskId: `${prefixe}${i - 1}`, type: typeLien(i), lag: decalage(i) }] : []));
}

const CAS = {
    /* Point 1 — 115 tâches en chaîne (la tête et la queue n'ont qu'un
       côté relié) et 4 tâches isolées : 6 sur 119. */
    logique: [...chaine('C', 115), ...[0, 1, 2, 3].map(k => T(`I${k}`, k))],
    /* Point 3 — 120 tâches en chaîne, donc 119 liens ; un sur vingt, 6 en
       tout, avec un décalage d'un jour : 6 sur 119. */
    retards: chaine('R', 120, () => 'FS', (i) => (i % 20 === 1 ? 1 : 0)),
    /* Point 4 — 250 tâches en chaîne, donc 249 liens ; un sur dix, 25 en
       tout, en Début→Début : 224 Fin→Début sur 249. */
    typesLiens: chaine('S', 250, (i) => (i % 10 === 1 ? 'SS' : 'FS')),
    /* BEI — 19 tâches toutes échues dans la référence, 18 terminées. */
    bei: Array.from({ length: 19 }, (_, i) => T(`B${i}`, i, [], { progress: i < 18 ? 100 : 0 })),
    /* Témoins sur le seuil. Point 1 : 40 tâches en chaîne, la tête et la
       queue sans logique, 2 sur 40 = 5 % exactement. BEI : 20 tâches
       échues, 19 terminées, 0,95 exactement. */
    logiqueBorne: chaine('W', 40),
    beiBorne: Array.from({ length: 20 }, (_, i) => T(`E${i}`, i, [], { progress: i < 19 ? 100 : 0 })),
    /* CPLI — une tâche qui finit 39 jours ouvrés après la date d'état
       (bornes incluses), une échéance 2 jours ouvrés plus tôt. */
    cpli: [T('L', 0, [], { endDate: jour(38) })],
};
const DATE_ETAT = { logique: jour(0), retards: jour(0), typesLiens: jour(0), bei: jour(30), cpli: jour(0),
                    logiqueBorne: jour(0), beiBorne: jour(30) };
const reference = (taches) => ({ baseline: { tasks: taches.map(t => ({ id: t.id, startDate: t.startDate, endDate: t.endDate })) } });
const EXTRA = {
    bei: reference(CAS.bei),
    beiBorne: reference(CAS.beiBorne),
    cpli: { echeance: jour(36) },
};

async function evaluer(page, cle) {
    return page.evaluate(async ({ taches, extra, dateEtat }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat, ...extra,
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        return Object.fromEntries(r.points.map(p => [p.n, p]));
    }, { taches: CAS[cle], extra: EXTRA[cle] || {}, dateEtat: DATE_ETAT[cle] });
}

test('DCMA : l\'état se mesure sur la valeur exacte, pas sur la valeur arrondie', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const logique = (await evaluer(page, 'logique'))[1];
    const retards = (await evaluer(page, 'retards'))[3];
    const types = (await evaluer(page, 'typesLiens'))[4];
    const bei = (await evaluer(page, 'bei'))[14];
    const cpli = (await evaluer(page, 'cpli'))[13];
    const logiqueBorne = (await evaluer(page, 'logiqueBorne'))[1];
    const beiBorne = (await evaluer(page, 'beiBorne'))[14];

    /* DISCRIMINANT 1 — LES PLANNINGS PRODUISENT LES RAPPORTS VOULUS, juste
       du mauvais côté du seuil, et l'arrondi les ramène dessus. Sans ce
       point, un état « alerte » pourrait venir d'un rapport plus éloigné du
       seuil que celui qu'on croit mesurer. Passe avant comme après. */
    expect([logique.numerateur, logique.denominateur, logique.valeur], 'point 1 : 6/119, affiché 5').toEqual([6, 119, 5]);
    expect([retards.numerateur, retards.denominateur, retards.valeur], 'point 3 : 6/119, affiché 5').toEqual([6, 119, 5]);
    expect([types.numerateur, types.denominateur, types.valeur], 'point 4 : 224/249, affiché 90').toEqual([224, 249, 90]);
    expect([bei.numerateur, bei.denominateur, bei.valeur], 'BEI : 18/19, affiché 0,95').toEqual([18, 19, 0.95]);
    expect([cpli.cpl, cpli.tf, cpli.valeur], 'CPLI : (39 − 2)/39, affiché 0,95').toEqual([39, -2, 0.95]);

    /* DISCRIMINANT 2 — EXACTEMENT SUR LE SEUIL, C'EST CONFORME. Sans ce
       point, l'assertion centrale passerait aussi avec une comparaison
       devenue stricte, qui mettrait en alerte un BEI de 0,95 ou 5 % de
       tâches sans logique. Passe avant comme après. */
    expect({ point1: [logiqueBorne.numerateur, logiqueBorne.denominateur, logiqueBorne.etat],
             bei: [beiBorne.numerateur, beiBorne.denominateur, beiBorne.etat] }, 'témoins exactement sur le seuil')
        .toEqual({ point1: [2, 40, 'ok'], bei: [19, 20, 'ok'] });

    // --- L'ASSERTION CENTRALE ---
    expect({ point1: logique.etat, point3: retards.etat, point4: types.etat, bei: bei.etat, cpli: cpli.etat },
        'états mesurés sur la valeur exacte')
        .toEqual({ point1: 'alerte', point3: 'alerte', point4: 'alerte', bei: 'alerte', cpli: 'alerte' });
});
