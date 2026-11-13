import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle du CPLI (point 13
 * du rapport DCMA) et des CONTRAINTES DE DATE.
 *
 * LE DÉFAUT. Le CPLI vaut (CPL + TF) / CPL, où TF est la marge de la fin
 * prévue sur la cible (l'échéance). Depuis la PR 2 (#115), une contrainte
 * l'emporte sur un lien : une « Doit finir le 09/06 » (MFO) dont le
 * prédécesseur finit le 05/06 est placée 05→09, et le lien Fin→Début est
 * ROMPU. Depuis la PR 4, la marge de ce prédécesseur le dit : −1 jour ouvré
 * (margeContrainte). Mais le point 13 ne lit que la fin prévue et la cible :
 * avec une échéance au 12/06, il annonce 1,43 « ok », trois jours de marge,
 * pour un planning qui ne tient déjà plus ses liens.
 *
 * LA RÈGLE ATTENDUE (plan v4, choix du coordinateur). TF est le minimum de
 * l'écart à la cible et des margeContrainte NÉGATIVES des tâches de la
 * population. Une margeContrainte négative n'existe qu'en amont d'un lien
 * rompu par une contrainte. Les autres ne comptent pas : une MSO ou une MFO
 * TENUE a une margeContrainte nulle, et la retenir ramènerait le CPLI à 1
 * quelle que soit l'échéance.
 *
 * LE VRAI MOTEUR, PAS UNE COPIE. Montage de contraintes-marges : un objet
 * qui hérite du prototype du store et ne lui substitue que getTasks(),
 * getTask() et _getCalendar(), et le vrai evaluerDcma. Le planning
 * n'existe que dans la page ; rien n'est écrit en base. Le test n'appelle
 * ni applyPredecessorConstraints, ni propagateDependencies, ni
 * _recalculatePhase : ils écrivent dans Supabase.
 *
 * JUIN 2026 COMMENCE UN LUNDI ; le 14/07 est férié.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « CPLI, contrainte qui rompt un lien » : « 1.43 ok (tf 3) » reçu
 * au lieu de « 0.86 alerte (tf -1) ». Les discriminants passent. */

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });
const C = (constraintType, constraintDate) => ({ constraintType, constraintDate });
const sansContrainte = (taches) => taches.map(({ constraintType, constraintDate, ...t }) => t);

/** Le lien rompu : A 01→05/06 ; B, Fin→Début de A, « Doit finir le
 *  09/06 », 3 jours ouvrés, placée 05→09 par sa contrainte. */
const ROMPU = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-05', '2026-06-09', [L('A')], C('MFO', '2026-06-09')),
];
/** Une MSO tenue, sans conflit : A 01→05/06 ; M « Doit commencer le
 *  08/06 », placée 08→10 ; Z, Fin→Début de M, 11→12/06. */
const TENU = [
    T('A', '2026-06-01', '2026-06-05'),
    T('M', '2026-06-08', '2026-06-10', [], C('MSO', '2026-06-08')),
    T('Z', '2026-06-11', '2026-06-12', [L('M')]),
];
/** Sans contrainte, la fin du projet loin après les échéances : TF très
 *  négatif. */
const LONG = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-08', '2026-06-10', [L('A')]),
    T('Z', '2026-06-01', '2026-12-31'),
];
const ECHEANCES = ['2026-06-09', '2026-06-12', '2026-07-31'];

async function mesurer(page, reseaux) {
    return page.evaluate(async ({ reseaux, echeances }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const dcma = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const sortie = {};
        for (const [nom, taches] of Object.entries(reseaux)) {
            const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
                getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
            });
            const a = moteur.analyzeNetwork();
            const point13 = {};
            let cpl = null;
            for (const echeance of echeances) {
                const p = dcma.evaluerDcma({
                    taches, calendrier: cal, dateEtat: '2026-06-01', echeance, analyse: a,
                    placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
                }).points.find(q => q.n === 13);
                point13[echeance] = `${p.valeur} ${p.etat} (tf ${p.tf})`;
                if (echeance === '2026-06-12') cpl = p.cpl;
            }
            sortie[nom] = {
                /* Le placement que le moteur donnerait à chaque tâche : null
                   (rien à placer) ou ses dates. */
                places: Object.fromEntries(taches.map(t => {
                    const p = moteur.computeConstrainedDatesIn(t, moteur.getTask);
                    return [t.id, p ? `${p.startDate}→${p.endDate}` : null];
                })),
                marges: a.float,
                point13, cpl,
            };
        }
        return sortie;
    }, { reseaux, echeances: ECHEANCES });
}

test('le CPLI tient compte d\'une contrainte qui rompt un lien, et d\'elle seule', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const r = await mesurer(page, {
        rompu: ROMPU, tenu: TENU,
        rompuNu: sansContrainte(ROMPU), tenuNu: sansContrainte(TENU), long: LONG,
    });

    /* DISCRIMINANT 1 — LE LIEN EST BIEN ROMPU PAR LA CONTRAINTE. Le moteur
       laisse B en 05→09, sur sa contrainte, avant la fin de A ; A a une
       marge de −1 jour ouvré, B une marge nulle. Ferme : « aucun lien n'est
       rompu » — le réseau monté ne serait pas celui du défaut, et un CPLI
       inchangé ne dirait rien de la règle. Passe avant comme après (PR 4). */
    expect(r.rompu.places, 'placement du réseau rompu').toEqual({ A: null, B: '2026-06-05→2026-06-09' });
    expect(r.rompu.marges, 'marges du réseau rompu').toEqual({ A: -1, B: 0 });

    /* DISCRIMINANT 2 — LE CPL EST CELUI QU'ON CROIT : 7 jours ouvrés du
       01/06 au 09/06, fin prévue. Ferme : « c'est le CPL qui a changé, pas
       TF » — le ratio pourrait bouger par son dénominateur. Passe avant
       comme après. */
    expect(r.rompu.cpl, 'CPL du réseau rompu').toBe(7);

    /* DISCRIMINANT 3 — SANS CONTRAINTE, RIEN NE CHANGE. Trois réseaux sans
       contrainte, trois échéances, point 13 égal aux valeurs mesurées sur
       la base (0c22993). Le premier est le réseau rompu SANS sa contrainte :
       B, laissée en 05→09, ne tient pas son lien, A a une marge de −1 par
       les liens seuls, et le CPLI ne la lit pas. Ferme : « la règle change
       le CPLI de données sans contrainte », y compris « elle lit la marge
       négative (float) au lieu de la seule margeContrainte ». Passe avant
       comme après. */
    expect({ rompuNu: r.rompuNu.point13, tenuNu: r.tenuNu.point13, long: r.long.point13 },
        'point 13 sans contrainte').toEqual({
        rompuNu: { '2026-06-09': '1 ok (tf 0)', '2026-06-12': '1.43 ok (tf 3)', '2026-07-31': '6.29 ok (tf 37)' },
        tenuNu: { '2026-06-09': '0.7 alerte (tf -3)', '2026-06-12': '1 ok (tf 0)', '2026-07-31': '4.4 ok (tf 34)' },
        long: { '2026-06-09': '0.05 alerte (tf -144)', '2026-06-12': '0.07 alerte (tf -141)', '2026-07-31': '0.29 alerte (tf -107)' },
    });

    /* DISCRIMINANT 4 — UNE MSO TENUE NE COMPTE PAS. M, « Doit commencer le
       08/06 », est à sa date et Z la suit sans conflit : sa margeContrainte
       est nulle. Échéance au 31/07 : 4.4 ok, tf 34, comme sans contrainte.
       Ferme : « une MSO ou MFO tenue ramène le CPLI à 1 » — la règle qui
       retiendrait toutes les margeContrainte donnerait « 1 ok (tf 0) ».
       Passe avant comme après. */
    expect(r.tenu.places, 'placement du réseau tenu').toEqual({ A: null, M: '2026-06-08→2026-06-10', Z: '2026-06-11→2026-06-12' });
    expect(r.tenu.point13['2026-07-31'], 'CPLI, MSO tenue').toBe('4.4 ok (tf 34)');

    // --- L'ASSERTION CENTRALE : une contrainte qui rompt un lien abaisse TF.
    /* Échéance au 12/06 : la fin prévue (09/06) a trois jours d'avance,
       mais le lien A → B est déjà rompu d'un jour. TF vaut −1, et le CPLI
       (7 − 1) / 7 = 0,86, sous le seuil de 0,95. */
    expect(r.rompu.point13['2026-06-12'], 'CPLI, contrainte qui rompt un lien').toBe('0.86 alerte (tf -1)');
});
