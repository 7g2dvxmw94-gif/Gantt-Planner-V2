import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B2 (phases) et § B12, sous l'angle des DATES
 * RÉELLES : une phase a un Début réel et une Fin réelle, tirés de ses
 * enfants, comme ses dates et son avancement.
 *
 * LA RÈGLE (plan des dates réelles, comme MS Project) : le Début réel
 * d'une phase est le plus tôt des Débuts réels de ses enfants ; sa Fin
 * réelle, la plus tardive de leurs Fins réelles, SEULEMENT quand TOUS en
 * ont une. Une sous-phase compte comme un enfant, avec son propre réel.
 * Recalculé par _recalculatePhase, comme dates et avancement.
 *
 * LE JEU, importé en JSON (l'import recalcule les phases, #145) :
 *   P  phase ⊃ P1 (08 → 10/06, commencée le 08, finie le 10),
 *              P2 (11 → 15/06, commencée le 11), P3 (16 → 17/06) ;
 *   Q  phase ⊃ Q1 (01 → 03/06, réel 01 → 03), Q2 (04 → 05/06, réel
 *              04 → 05) : finie ;
 *   R  phase ⊃ R1, phase ⊃ R1a (22 → 23/06, réel 22 → 23) : la fin
 *              remonte de deux niveaux ;
 *   S  phase ⊃ S1 (24 → 25/06), sans réel.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : toutes les phases relues « réel —→— ». Les discriminants — les
 * enfants intacts, dates et avancement des phases déjà tirés d'eux —
 * passent. */

function jeu(s) {
    const t = (cle, ordre, debut, fin, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const phase = (cle, ordre, parent = null) => t(cle, ordre, '2026-07-01', '2026-07-01', { isPhase: true, parentId: parent });
    const fini = (a, b) => ({ actualStart: a, actualFinish: b, progress: 100, status: 'done' });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesPhases ${s}`, description: '' },
        tasks: [
            phase('P', 0),
            t('P1', 1, '2026-06-08', '2026-06-10', { parentId: 'jeu-P', ...fini('2026-06-08', '2026-06-10') }),
            t('P2', 2, '2026-06-11', '2026-06-15', { parentId: 'jeu-P', actualStart: '2026-06-11', progress: 50, status: 'in_progress' }),
            t('P3', 3, '2026-06-16', '2026-06-17', { parentId: 'jeu-P' }),
            phase('Q', 4),
            t('Q1', 5, '2026-06-01', '2026-06-03', { parentId: 'jeu-Q', ...fini('2026-06-01', '2026-06-03') }),
            t('Q2', 6, '2026-06-04', '2026-06-05', { parentId: 'jeu-Q', ...fini('2026-06-04', '2026-06-05') }),
            phase('R', 7),
            phase('R1', 8, 'jeu-R'),
            t('R1a', 9, '2026-06-22', '2026-06-23', { parentId: 'jeu-R1', ...fini('2026-06-22', '2026-06-23') }),
            phase('S', 10),
            t('S1', 11, '2026-06-24', '2026-06-25', { parentId: 'jeu-S' }),
        ],
        resources: [],
    };
}

/** « clé:début→fin avancement% réel début→fin », lu dans le store VIVANT. */
async function lire(page, s, cles) {
    return page.evaluate(async ({ s, cles }) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return cles.map(c => {
            const x = store.getTasks().filter(t => t.name === `${c} ${s}`);
            if (x.length !== 1) return `${c}:${x.length} tâche(s)`;
            const t = x[0];
            return `${c}:${t.startDate}→${t.endDate} ${t.progress}% réel ${t.actualStart ?? '—'}→${t.actualFinish ?? '—'}`;
        }).join(' | ');
    }, { s: String(s), cles });
}

test('une phase tire son Début réel et sa Fin réelle de ses enfants', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'dates-reelles-phases.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* DISCRIMINANT — LES ENFANTS SONT ARRIVÉS INTACTS, réels compris. Ferme
       « une phase sans réel parce que ses enfants l'ont perdu ». */
    expect(await lire(page, s, ['P1', 'P2', 'P3', 'R1a']), 'les enfants importés').toBe(
        'P1:2026-06-08→2026-06-10 100% réel 2026-06-08→2026-06-10 | P2:2026-06-11→2026-06-15 50% réel 2026-06-11→— | '
        + 'P3:2026-06-16→2026-06-17 0% réel —→— | R1a:2026-06-22→2026-06-23 100% réel 2026-06-22→2026-06-23');

    // --- L'ASSERTION CENTRALE ---
    /* Dates et avancement des phases sont déjà tirés des enfants (ils le
       sont avant comme après) ; le réel doit l'être aussi. */
    const attendu = 'P:2026-06-08→2026-06-17 50% réel 2026-06-08→— | Q:2026-06-01→2026-06-05 100% réel 2026-06-01→2026-06-05 | '
        + 'R:2026-06-22→2026-06-23 100% réel 2026-06-22→2026-06-23 | R1:2026-06-22→2026-06-23 100% réel 2026-06-22→2026-06-23 | '
        + 'S:2026-06-24→2026-06-25 0% réel —→—';
    expect(await lire(page, s, ['P', 'Q', 'R', 'R1', 'S']), 'le réel des phases, tiré des enfants').toBe(attendu);

    /* TÉMOIN — relu de la base : le réel des phases est écrit, pas
       seulement calculé. */
    await page.reload();
    await waitForAppReady(page);
    await expect.poll(async () => lire(page, s, ['P', 'Q', 'R', 'R1', 'S']),
        { message: 'après rechargement', timeout: 15_000 }).toBe(attendu);

    await deleteActiveProject(page);
});
