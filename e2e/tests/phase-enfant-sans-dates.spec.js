import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § B2 (phases), troisième angle après phase.spec.js
 * et phase-fuseau-ouest.spec.js : un enfant SANS DATES dans la phase.
 *
 * LE DÉFAUT : un seul enfant sans dates efface la date de début de sa
 * phase. _recalculatePhase() prend la plus petite date de début des
 * enfants en comparant des chaînes :
 *
 *     phase.startDate = children.reduce(
 *         (mini, c) => (mini === null || c.startDate < mini) ? c.startDate : mini, null);
 *
 * La chaîne vide précède toute date ISO : un enfant dont startDate vaut ''
 * l'emporte, quelle que soit sa place. La phase repart avec une date de
 * début VIDE, et l'upsertTask(phase) de fin de fonction l'envoie en base —
 * taskToRow en fait une start_date nulle.
 *
 * C'EST LA FORME DU DÉFAUT DE analyzeNetwork(), corrigé par la PR #91 :
 * une comparaison de chaînes où la chaîne vide concourt comme une date.
 *
 * UN ENFANT SANS DATES N'A RIEN D'EXOTIQUE. La base admet start_date et
 * end_date nulles, et rowToTask les rend en '' ; l'import Excel met ''
 * pour une date illisible (fmtDate). Et le chargement d'un projet
 * (_loadProjectData) repasse _recalculatePhase sur CHAQUE phase du projet :
 * la date effacée l'est à nouveau, et renvoyée en base, à chaque
 * chargement.
 *
 * MESURÉ dans la page, sur le vrai store, avec les enfants de ce fichier :
 *
 *     enfants                         début de la phase   fin de la phase
 *     A et B, datés                   2026-06-01          2026-06-19
 *     X sans dates en tête            ''                  2026-06-19
 *     X sans dates au milieu          ''                  2026-06-19
 *     X sans dates en queue           ''                  2026-06-19
 *
 * LA FIN N'EST PAS ATTEINTE : au maximum, la chaîne vide ne l'emporte sur
 * aucune date, même placée en tête, où elle amorce le calcul. Le test le
 * vérifie quand même, l'assertion centrale portant sur les deux bornes.
 *
 * LE MONTAGE : le vrai _recalculatePhase, celui du prototype du store,
 * appliqué à un objet moteur qui ne porte que les tâches. La fonction lit
 * this._data.tasks directement — ni getTasks() ni getTask() —, et ne
 * touche rien d'autre sur this. Sa seule écriture est
 * supabaseStore.upsertTask(phase) : elle est remplacée par un bouchon qui
 * note ce qui partirait en base, et rétablie aussitôt. Le remplacement,
 * l'appel et le rétablissement s'enchaînent sans un seul await : aucun
 * autre code de la page ne peut s'exécuter entre-temps, ni voir le
 * bouchon, ni écrire à travers lui.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « phase avec un enfant sans dates ». */

const T = (id, debut, fin) => ({
    id, name: id, parentId: 'P', startDate: debut, endDate: fin, progress: 0, dependencies: [],
});
/* La phase part de dates qu'aucun enfant ne porte : la retrouver aux dates
   des enfants établit que _recalculatePhase a tourné jusqu'au bout. */
const PHASE = {
    id: 'P', name: 'P', parentId: null, isPhase: true,
    startDate: '2020-01-06', endDate: '2020-01-10', progress: 0, dependencies: [],
};
const A = T('A', '2026-06-01', '2026-06-05');
const B = T('B', '2026-06-08', '2026-06-19');
const X = T('X', '', '');
const Y = T('Y', '', '');

async function recalculer(page, enfants) {
    return page.evaluate(async ({ phase, enfants }) => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { supabaseStore } = await import(new URL('js/supabase-store.js', base).href);
        const taches = [{ ...phase }, ...enfants.map(e => ({ ...e }))];
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            _data: { tasks: taches },
        });
        const envois = [];
        const upsertTask = supabaseStore.upsertTask;
        supabaseStore.upsertTask = (t) => {
            envois.push({ id: t.id, startDate: t.startDate, endDate: t.endDate });
            return Promise.resolve();
        };
        try {
            moteur._recalculatePhase('P');
        } finally {
            supabaseStore.upsertTask = upsertTask;
        }
        const p = taches[0];
        return { phase: { startDate: p.startDate, endDate: p.endDate }, envois };
    }, { phase: PHASE, enfants });
}

test('un enfant sans dates n\'efface pas la date de début de sa phase', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const sans = await recalculer(page, [A, B]);

    /* DISCRIMINANT 1 — SANS X, LA PHASE VA DU PLUS TÔT AU PLUS TARD DE SES
       ENFANTS, et c'est ce qui partirait en base, par le bouchon. Ferme
       trois mensonges : une fonction sortie avant le calcul (la phase
       serait restée en janvier 2020) ; une écriture qui aurait contourné le
       bouchon (rien ne serait noté) ; et une égalité centrale qui
       comparerait deux résultats également faux. Passe avant comme après. */
    expect(sans, 'phase aux enfants tous datés').toEqual({
        phase: { startDate: '2026-06-01', endDate: '2026-06-19' },
        envois: [{ id: 'P', startDate: '2026-06-01', endDate: '2026-06-19' }],
    });

    /* DISCRIMINANT 2 — SANS AUCUN ENFANT DATÉ, LA PHASE RESTE SANS DATES,
       et sans dates veut dire la chaîne vide, comme aujourd'hui : celle que
       rowToTask donne à une tâche sans dates. Ferme le mensonge d'un
       correctif qui écarterait les dates invalides et laisserait null faute
       de candidate : parseISO('') est une date invalide, mais parseISO(null)
       est l'instant zéro, une date VALIDE — mesuré : 1970-01-01 en UTC,
       1969-12-31 à New York. Une phase à null passerait pour une phase
       datée. Passe avant comme après. */
    expect(await recalculer(page, [X, Y]), 'phase sans aucun enfant daté').toEqual({
        phase: { startDate: '', endDate: '' },
        envois: [{ id: 'P', startDate: '', endDate: '' }],
    });

    // --- L'ASSERTION CENTRALE : X ne change rien à la phase, où qu'il soit.
    const enTete   = await recalculer(page, [X, A, B]);
    const auMilieu = await recalculer(page, [A, X, B]);
    const enQueue  = await recalculer(page, [A, B, X]);
    expect({ enTete, auMilieu, enQueue }, 'phase avec un enfant sans dates')
        .toEqual({ enTete: sans, auMilieu: sans, enQueue: sans });
});
