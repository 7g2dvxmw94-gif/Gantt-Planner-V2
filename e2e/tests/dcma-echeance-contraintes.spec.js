import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), dans son prolongement : les
 * points 6 et 7 du rapport DCMA (marge élevée, marge négative) quand le
 * projet a une ÉCHÉANCE et des CONTRAINTES DE DATE.
 *
 * LE DÉFAUT. Avec une échéance, dcma.js mesure les marges contre elle, et
 * non plus contre la fin prévue : il ajoute à la marge de CHAQUE tâche le
 * même écart, celui de la fin prévue à l'échéance. Son commentaire le
 * justifie : « toutes les marges se translatent du même écart, puisque la
 * passe arrière part d'une borne commune ». Depuis la PR 4, ce n'est plus
 * vrai. La marge d'analyzeNetwork() est le minimum de deux marges :
 * `margeFin`, bornée par la fin du projet, qui suit bien l'échéance, et
 * `margeContrainte`, bornée par les contraintes de date, qui ne la suit
 * pas. Une tâche qui DOIT finir le 30/06 a la même marge que le projet
 * finisse en décembre ou en juin de l'année suivante. Translater sa marge
 * entière la déclare en retard sur une échéance qui ne la concerne pas, ou
 * lui prête une marge qu'elle n'a pas.
 *
 * LA RÈGLE ATTENDUE : marge = min(margeFin + écart,
 * margeContrainte). Sans contrainte, margeContrainte vaut Infinity et la
 * marge est celle d'avant ; sans échéance, l'écart est nul et la marge est
 * `float`, celle d'avant aussi.
 *
 * LE VRAI MOTEUR, PAS UNE COPIE. Montage de contraintes-marges et de
 * dcma-calcul : un objet qui hérite du prototype du store et ne lui
 * substitue que getTasks(), getTask() et _getCalendar() ; analyzeNetwork()
 * et evaluerDcma() sont ceux des fichiers. Le planning n'existe que dans la
 * page ; rien n'est écrit en base. Le test n'appelle ni
 * applyPredecessorConstraints, ni propagateDependencies, ni
 * _recalculatePhase : ils écrivent dans Supabase.
 *
 * LA DATE D'ÉTAT EST FIXÉE (01/06/2026), pas lue sur l'horloge. JUIN 2026
 * COMMENCE UN LUNDI et n'a aucun férié (22 jours ouvrés).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « point 7, échéance au 30/11/2026 » : 100:alerte /4 [A,B,Z,M]
 * reçu au lieu de 25:alerte /4 [Z]. Les discriminants passent. */

const DATE_ETAT = '2026-06-01';

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });
const C = (constraintType, constraintDate) => ({ constraintType, constraintDate });

/** Le réseau de la PR 4 (contraintes-marges), M compris. A, semaine du 1er
 *  juin ; B, Fin→Début de A, « Fin au plus tard le 30/06 », placée 08→10 ;
 *  Z, longue, porte la fin du projet au 31/12 ; M, racine « Doit commencer
 *  le 15/06 », placée 15→17. */
const RESEAU = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-08', '2026-06-10', [L('A')], C('FNLT', '2026-06-30')),
    T('Z', '2026-06-01', '2026-12-31'),
    T('M', '2026-06-15', '2026-06-17', [], C('MSO', '2026-06-15')),
];
/** Le même, sans aucune contrainte. */
const RESEAU_NU = RESEAU.map(({ constraintType, constraintDate, ...t }) => t);

/** Une échéance avant la fin prévue (31/12/2026), et une après. */
const AVANT = '2026-11-30';
const APRES = '2027-06-30';

/** Les 14 points du réseau SANS contrainte, mesurés sur la base de ce test
 *  (après la PR 4), à chacune des deux échéances. Une ligne par point : n°,
 *  valeur, état, dénominateur, fautives. Seuls 6, 7 et 13 dépendent de
 *  l'échéance. */
const COMMUNS = {
    1: '1:100:alerte /4 [A,B,Z,M]', 2: '2:0:ok /1 []', 3: '3:0:ok /1 []', 4: '4:100:ok /1 []',
    5: '5:—:sans-objet /4 []', 8: '8:25:alerte /4 [Z]', 9: '9:0:ok /4 []', 10: '10:100:info /4 [A,B,Z,M]',
    11: '11:—:na /0 []', 12: '12:—:na /undefined []', 14: '14:—:na /undefined []',
};
const D3_AVANT = { ...COMMUNS, 6: '6:75:alerte /4 [A,B,M]', 7: '7:25:alerte /4 [Z]', 13: '13:0.85:alerte /undefined []' };
const D3_APRES = { ...COMMUNS, 6: '6:100:alerte /4 [A,B,Z,M]', 7: '7:0:ok /4 []', 13: '13:1.83:ok /undefined []' };

async function mesurer(page, cas) {
    return page.evaluate(async ({ cas, dateEtat }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const dcma = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteurDe = (taches) => Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        /* Un point en une ligne : n°, valeur, état, dénominateur, fautives. */
        const ligne = (p) => `${p.n}:${p.valeur === null ? '—' : p.valeur}:${p.etat} /${p.denominateur} [${(p.fautives || []).join(',')}]`;
        const sortie = { joursOuvresJuin: utils.workingDaysBetween('2026-06-01', '2026-06-30', cal) };
        for (const [nom, { taches, echeance }] of Object.entries(cas)) {
            const moteur = moteurDe(taches);
            const analyse = moteur.analyzeNetwork();
            const rapport = dcma.evaluerDcma({
                taches, calendrier: cal, dateEtat, echeance, analyse,
                placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
            });
            sortie[nom] = {
                float: analyse.float,
                placesB: (p => p ? `${p.startDate}→${p.endDate}` : null)(moteur.computeConstrainedDatesIn(taches[1], moteur.getTask)),
                finPrevue: rapport.finPrevue,
                points: Object.fromEntries(rapport.points.map(p => [p.n, ligne(p)])),
            };
        }
        return sortie;
    }, { cas, dateEtat: DATE_ETAT });
}

test('avec une échéance, la marge d\'une tâche contrainte n\'est plus décalée', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const r = await mesurer(page, {
        sans: { taches: RESEAU, echeance: null },
        avant: { taches: RESEAU, echeance: AVANT },
        apres: { taches: RESEAU, echeance: APRES },
        nuAvant: { taches: RESEAU_NU, echeance: AVANT },
        nuApres: { taches: RESEAU_NU, echeance: APRES },
    });

    /* DISCRIMINANT 0 — LE CALENDRIER, LE PLACEMENT ET LA FIN PRÉVUE SONT
       CEUX QU'ON CROIT. Juin 2026 compte 22 jours ouvrés ; le moteur laisse
       B en 08→10 ; la fin prévue, d'où part l'écart à l'échéance, est le
       31/12/2026. Ferme : « l'écart n'est pas celui qu'on croit, ou les
       marges mesurent un planning que le moteur aurait déplacé ». Passe
       avant comme après. */
    expect(r.joursOuvresJuin, 'jours ouvrés de juin 2026').toBe(22);
    expect(r.sans.placesB, 'placement de B par le moteur').toBe('2026-06-08→2026-06-10');
    expect([r.avant.finPrevue, r.apres.finPrevue], 'fin prévue').toEqual(['2026-12-31', '2026-12-31']);

    /* DISCRIMINANT 1 — LES MARGES SONT CELLES DE LA PR 4. A et B, bornées
       par la « Fin au plus tard le 30/06 », ont 14 jours ; Z porte la fin ;
       M, « Doit commencer le 15/06 » tenue, n'en a aucune. Ferme : « on
       mesure sans la PR 4 », où la marge ignorerait les contraintes (A et B
       143, M 138) et où rien ne distinguerait une tâche contrainte d'une
       autre. Passe avant comme après. */
    expect(r.sans.float, 'marges d\'analyzeNetwork').toEqual({ A: 14, B: 14, Z: 0, M: 0 });

    /* DISCRIMINANT 2 — SANS ÉCHÉANCE, RIEN NE CHANGE. Point 6 à 0 % (aucune
       marge au-delà de 44 jours ouvrés), point 7 non applicable. Ferme :
       « le calcul sans échéance a changé », que la décomposition de la
       marge aurait pu toucher. Passe avant comme après. */
    expect([r.sans.points[6], r.sans.points[7]], 'points 6 et 7 sans échéance')
        .toEqual(['6:0:ok /4 []', '7:—:na /4 []']);

    /* DISCRIMINANT 3 — SANS CONTRAINTE, RIEN NE CHANGE, MÊME AVEC UNE
       ÉCHÉANCE. Le même réseau privé de ses contraintes garde ses 14 points,
       à l'échéance d'avant comme à celle d'après la fin prévue. Valeurs
       mesurées sur la base de ce test (après la PR 4). Ferme : « la
       décomposition change les plannings sans contrainte » — y compris
       « l'écart à l'échéance n'est plus appliqué ». Passe avant comme
       après. */
    expect(r.nuAvant.points, '14 points, sans contrainte, échéance au 30/11/2026').toEqual(D3_AVANT);
    expect(r.nuApres.points, '14 points, sans contrainte, échéance au 30/06/2027').toEqual(D3_APRES);

    // --- L'ASSERTION CENTRALE : l'échéance ne décale que la marge des liens.
    /* Échéance au 30/11/2026, avant la fin prévue. Z, sans contrainte, porte
       la fin : elle est en retard sur l'échéance. A et B doivent finir le
       30/06 et ont toujours leurs 14 jours ; M, tenue à sa date, n'est en
       retard sur rien. */
    expect(r.avant.points[7], 'point 7, échéance au 30/11/2026').toBe('7:25:alerte /4 [Z]');
    /* Échéance au 30/06/2027, après la fin prévue. Seule Z gagne la marge
       que l'échéance lui donne ; A, B et M restent tenues par leur
       contrainte. */
    expect(r.apres.points[6], 'point 6, échéance au 30/06/2027').toBe('6:25:alerte /4 [Z]');
});
