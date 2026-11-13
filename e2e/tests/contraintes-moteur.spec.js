import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § B7 (types de lien et décalage), sous l'angle des
 * CONTRAINTES DE DATE : « Début au plus tôt le » (SNET), « Début au plus
 * tard le » (SNLT), « Fin au plus tôt le » (FNET), « Fin au plus tard le »
 * (FNLT), « Doit commencer le » (MSO) et « Doit finir le » (MFO), comme
 * dans MS Project.
 *
 * LE BESOIN. Une tâche garde sa contrainte en base depuis la PR 1 (#113),
 * mais le moteur de placement l'ignore : _computeConstrainedDates()
 * (store.js) ne lit que les liens, et rend null pour une tâche sans lien.
 * Une « Doit finir le 19 juin » est donc placée comme une « Dès que
 * possible ».
 *
 * LA RÈGLE ATTENDUE (décisions de l'utilisateur) : LA CONTRAINTE L'EMPORTE
 * sur les liens, comme MS Project par défaut. Le placement des liens est
 * calculé d'abord, exactement comme aujourd'hui ; la contrainte s'applique
 * ensuite à ce placement, durée OUVRÉE conservée. Une date de contrainte
 * posée sur un jour non ouvré est recalée : au jour ouvré SUIVANT pour
 * « au plus tôt » et « doit commencer », au jour ouvré PRÉCÉDENT pour
 * « au plus tard » et « doit finir ». Une tâche sans lien est placée par
 * sa seule contrainte.
 *
 * LE VRAI MOTEUR, PAS UNE COPIE. Montage de dcma-calcul.spec.js : un objet
 * qui hérite du prototype du store et ne lui substitue que getTask() et
 * _getCalendar(). C'est le code même que l'application exécute, sur un
 * planning qui n'existe que dans la page. Rien n'est écrit en base. Le test
 * n'appelle ni applyPredecessorConstraints, ni propagateDependencies, ni
 * _recalculatePhase : ils écrivent dans Supabase.
 *
 * LES 29 CAS. Vingt-cinq sont ceux du tableau du plan (plan.md §2 (b)),
 * mesurés sur un prototype posé sur le vrai _computeConstrainedDates
 * (log-moteur.txt). Le tableau ne posait une date de contrainte sur un
 * jour non ouvré que pour MSO et MFO : quatre cas, un par type SNET,
 * SNLT, FNET et FNLT, la posent un samedi ou un dimanche, pour que le
 * SENS du recalage soit vérifié type par type (une erreur sur un seul
 * type passait). Leurs attendus sont mesurés sur le moteur du commit de
 * fonctionnalité, et chacun diffère de celui du sens inverse.
 * A : lundi 01 → vendredi 05/06/2026. B : trois jours ouvrés, liée à A en
 * Fin→Début sans décalage sauf mention, saisie loin (22 → 24/06) pour que
 * le placement vienne du moteur. JUIN 2026 COMMENCE UN LUNDI et n'a aucun
 * férié ; le 14 juillet est férié.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale. La chaîne reçue montre, pour les 21 cas, le placement « dès que
 * possible » : celui des liens, ou les dates saisies pour une racine. Les
 * quatre discriminants passent. */

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });
const C = (constraintType, constraintDate) => ({ constraintType, constraintDate });

const A = T('A', '2026-06-01', '2026-06-05');
/** B, saisie loin de sa place : c'est le moteur qui la place. */
const B = (liens, extra = {}) => T('B', '2026-06-22', '2026-06-24', liens, extra);

/* [nom, tâche placée, placement attendu]. L'attendu de chaque ligne est la
   colonne « Placement final » du tableau du plan, sauf les quatre lignes
   « jour non ouvré » de LIANTES, mesurées (voir leur commentaire). */
const DES_QUE_POSSIBLE = [
    ['FS',    B([L('A')]),             '2026-06-08→2026-06-10'],
    ['FS+3',  B([L('A', 'FS', 3)]),    '2026-06-09→2026-06-11'],
    ['SS+2',  B([L('A', 'SS', 2)]),    '2026-06-03→2026-06-05'],
    ['FF',    B([L('A', 'FF')]),       '2026-06-03→2026-06-05'],
    ['SF',    B([L('A', 'SF')]),       '2026-05-28→2026-06-01'],
];
const NON_LIANTES = [
    ['SNET 03/06',                     B([L('A')], C('SNET', '2026-06-03')),                       '2026-06-08→2026-06-10'],
    ['SNLT 12/06',                     B([L('A')], C('SNLT', '2026-06-12')),                       '2026-06-08→2026-06-10'],
    ['racine SNET 10/06 posée 17→19',  T('R', '2026-06-17', '2026-06-19', [], C('SNET', '2026-06-10')), '2026-06-17→2026-06-19'],
];
const LIANTES = [
    ['SNET 10/06',                     B([L('A')], C('SNET', '2026-06-10')),          '2026-06-10→2026-06-12'],
    ['SNLT 05/06',                     B([L('A')], C('SNLT', '2026-06-05')),          '2026-06-05→2026-06-09'],
    ['FNET 15/06',                     B([L('A')], C('FNET', '2026-06-15')),          '2026-06-11→2026-06-15'],
    ['FNLT 09/06',                     B([L('A')], C('FNLT', '2026-06-09')),          '2026-06-05→2026-06-09'],
    ['MSO 15/06',                      B([L('A')], C('MSO', '2026-06-15')),           '2026-06-15→2026-06-17'],
    ['MSO 04/06',                      B([L('A')], C('MSO', '2026-06-04')),           '2026-06-04→2026-06-08'],
    ['MFO 19/06',                      B([L('A')], C('MFO', '2026-06-19')),           '2026-06-17→2026-06-19'],
    ['MFO samedi 13/06',               B([L('A')], C('MFO', '2026-06-13')),           '2026-06-10→2026-06-12'],
    ['MSO samedi 13/06',               B([L('A')], C('MSO', '2026-06-13')),           '2026-06-15→2026-06-17'],
    /* Un type par ligne, date de contrainte un samedi ou un dimanche, B
       derrière A en Fin→Début (socle 08→10). Au plus tôt : jour ouvré
       SUIVANT ; au plus tard : PRÉCÉDENT. Attendus mesurés sur le moteur
       du commit de fonctionnalité. Le sens inverse, mesuré par un mutant
       qui ne le retourne que pour ce type, donne : SNET 12→16, SNLT 08→10
       (le lundi ne lie plus), FNET 10→12, FNLT 04→08. Chaque attendu en
       diffère : une erreur de sens sur un seul type rompt la chaîne. */
    ['SNET samedi 13/06',              B([L('A')], C('SNET', '2026-06-13')),          '2026-06-15→2026-06-17'],
    ['SNLT samedi 06/06',              B([L('A')], C('SNLT', '2026-06-06')),          '2026-06-05→2026-06-09'],
    ['FNET dimanche 14/06',            B([L('A')], C('FNET', '2026-06-14')),          '2026-06-11→2026-06-15'],
    ['FNLT dimanche 07/06',            B([L('A')], C('FNLT', '2026-06-07')),          '2026-06-03→2026-06-05'],
    ['FS+3 SNLT 08/06',                B([L('A', 'FS', 3)], C('SNLT', '2026-06-08')), '2026-06-08→2026-06-10'],
    ['SS+2 FNET 12/06',                B([L('A', 'SS', 2)], C('FNET', '2026-06-12')), '2026-06-10→2026-06-12'],
    ['FF MSO 01/06',                   B([L('A', 'FF')], C('MSO', '2026-06-01')),     '2026-06-01→2026-06-03'],
    ['SF SNET 01/06',                  B([L('A', 'SF')], C('SNET', '2026-06-01')),    '2026-06-01→2026-06-03'],
    ['racine SNET 10/06 posée 03→05',  T('R', '2026-06-03', '2026-06-05', [], C('SNET', '2026-06-10')), '2026-06-10→2026-06-12'],
    ['racine MSO 14/07 (férié)',       T('R', '2026-06-17', '2026-06-19', [], C('MSO', '2026-07-14')),  '2026-07-15→2026-07-17'],
    ['racine MFO 14/07 (férié)',       T('R', '2026-06-17', '2026-06-19', [], C('MFO', '2026-07-14')),  '2026-07-09→2026-07-13'],
    ['jalon FS de A, MFO samedi 13/06', T('J', '2026-06-22', '2026-06-22', [L('A')], { isMilestone: true, ...C('MFO', '2026-06-13') }), '2026-06-12→2026-06-12'],
];

/** Place chaque tâche, seule avec A, par les DEUX entrées du moteur :
 *  _computeConstrainedDates() (le placement de l'application) et
 *  computeConstrainedDatesIn() (le rejeu du DCMA, faux `this`). */
async function placer(page, cas) {
    return page.evaluate(async ({ A, cas }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const fmt = (p) => p ? `${p.startDate}→${p.endDate}` : 'null';
        const calendrier = {
            joursOuvresJuin: utils.workingDaysBetween('2026-06-01', '2026-06-30', cal),
            quatorzeJuilletOuvre: utils.isWorkingDay('2026-07-14', cal),
        };
        const resultats = cas.map(([nom, t]) => {
            const taches = [A, t];
            const getTask = (id) => taches.find(x => x.id === id);
            const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
                getTasks: () => taches, getTask, _getCalendar: () => cal,
            });
            const direct = moteur._computeConstrainedDates(t);
            const copie  = moteur.computeConstrainedDatesIn(t, getTask);
            /* Placement EFFECTIF : null veut dire « la tâche reste où elle
               est », c'est-à-dire à ses dates. */
            const effectif = direct ?? { startDate: t.startDate, endDate: t.endDate };
            return { nom, direct: fmt(direct), copie: fmt(copie), effectif: fmt(effectif) };
        });
        return { calendrier, resultats };
    }, { A, cas: cas.map(([nom, t]) => [nom, t]) });
}

const chaine = (resultats) => resultats.map(r => `${r.nom}: ${r.effectif}`).join(' | ');
const attendue = (cas) => cas.map(([nom, , p]) => `${nom}: ${p}`).join(' | ');

test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
});

test('le moteur place chaque tâche selon sa contrainte de date, et la contrainte l\'emporte sur les liens', async ({ page }) => {
    const tous = [...DES_QUE_POSSIBLE, ...NON_LIANTES, ...LIANTES];
    expect(tous.length, 'les 29 cas : les 25 du tableau du plan et les 4 « jour non ouvré »').toBe(29);
    const r = await placer(page, tous);
    const parNom = (cas) => cas.map(([nom]) => r.resultats.find(x => x.nom === nom));

    /* DISCRIMINANT 1 — LE CALENDRIER EST CELUI DES EXEMPLES : lundi-vendredi
       et fériés français, 22 jours ouvrés en juin 2026, le 14 juillet
       chômé. Ferme « ce n'est pas le calendrier des exemples » : sans les
       fériés, la racine MSO du 14 juillet commencerait le 14, et l'échec
       viendrait du calendrier, pas de la contrainte. Passe avant comme
       après. */
    expect(r.calendrier, 'le calendrier n\'est pas celui des exemples (22 jours ouvrés en juin, 14/07 férié)')
        .toEqual({ joursOuvresJuin: 22, quatorzeJuilletOuvre: false });

    /* DISCRIMINANT 2 — LES LIENS PLACENT COMME AUJOURD'HUI. Les cinq lignes
       « dès que possible » : Fin→Début, avec décalage, Début→Début,
       Fin→Fin, Début→Fin. Ferme « le montage des liens est faux » : si A
       n'était pas trouvée, ou si les liens étaient mal lus, aucune
       contrainte ne pourrait être jugée sur son socle. Passe avant comme
       après. */
    expect(chaine(parNom(DES_QUE_POSSIBLE)), 'placement « dès que possible » par les seuls liens')
        .toBe(attendue(DES_QUE_POSSIBLE));

    /* DISCRIMINANT 3 — UNE CONTRAINTE QUI NE LIE PAS NE DÉPLACE RIEN. Un
       « au plus tôt le 03/06 » derrière un lien qui exige le 08, un « au
       plus tard le 12/06 » devant lui, une racine « au plus tôt le 10/06 »
       déjà posée le 17. Comparé sur le placement EFFECTIF (le résultat, ou
       les dates de la tâche quand il est null) : une racine rendait null
       avant, et rend ses dates après. Ferme « la contrainte déplace une
       tâche qu'elle ne contraint pas » : l'assertion centrale ne pourra
       pas passer par un moteur qui pousse tout à la date de contrainte.
       Passe avant comme après. */
    expect(chaine(parNom(NON_LIANTES)), 'contraintes non liantes : la tâche reste où les liens la mettent')
        .toBe(attendue(NON_LIANTES));

    /* DISCRIMINANT 4 — LES DEUX ENTRÉES DU MOTEUR RENDENT LA MÊME CHOSE,
       cas par cas : _computeConstrainedDates(), qu'appellent le glisser, la
       fiche et la propagation, et computeConstrainedDatesIn(), qu'appelle
       le rejeu du DCMA sur une copie (faux `this`, qui ne connaît que
       getTask et _getCalendar). Ferme « une seule des deux entrées applique
       la contrainte » : un moteur qui lirait la contrainte par une méthode
       du store absente du faux `this` passerait ici en placement et
       casserait le DCMA. Passe avant (les deux l'ignorent) comme après. */
    const divergences = r.resultats.filter(x => x.direct !== x.copie)
        .map(x => `${x.nom}: ${x.direct} / ${x.copie}`);
    expect(divergences, '_computeConstrainedDates et computeConstrainedDatesIn divergent').toEqual([]);

    /* --- L'ASSERTION CENTRALE ---
       Les 21 lignes où la contrainte change le placement, en une chaîne
       comparée d'un bloc. Tant que le moteur ignore la contrainte, la
       chaîne reçue montre le placement des liens, ou les dates saisies
       d'une racine. */
    const recue = chaine(parNom(LIANTES));
    expect(recue, `placements reçus : ${recue}`).toBe(attendue(LIANTES));

    /* Et la contrainte passe par contrainteDe() : une phase n'en porte
       pas, un type inconnu ou une date qui n'existe pas valent « dès que
       possible ». */
    const ecartees = await placer(page, [
        ['phase MSO 15/06', T('P', '2026-06-01', '2026-06-03', [], { isPhase: true, ...C('MSO', '2026-06-15') })],
        ['type XYZ', B([L('A')], C('XYZ', '2026-06-15'))],
        ['MSO 30/02', B([L('A')], C('MSO', '2026-02-30'))],
    ]);
    expect(chaine(ecartees.resultats), 'contraintes écartées par contrainteDe')
        .toBe('phase MSO 15/06: 2026-06-01→2026-06-03 | type XYZ: 2026-06-08→2026-06-10 | MSO 30/02: 2026-06-08→2026-06-10');
});
