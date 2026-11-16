import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G (import JSON) et § B2 (phases) : une phase
 * importée suit ses enfants dès l'import, pas au rechargement suivant.
 *
 * LE DÉFAUT. importProject (store.js) recopie chaque tâche du fichier, la
 * phase avec les dates et l'avancement qu'elle porte dans le fichier, et
 * ne recalcule aucune phase. _loadProjectData, lui, les recalcule toutes
 * (_recalculerToutesLesPhases, #135) : la phase n'affiche donc ses vraies
 * valeurs qu'après un rechargement. Forme « un mécanisme construit puis
 * laissé débranché » : la règle existe, l'import ne l'appelle pas. Le WBS
 * (organigramme, F3a) affiche l'avancement des phases dès l'import.
 *
 * LE JEU, importé en JSON. La phase A porte dans le fichier 0 % et 8–12
 * juin ; ses enfants : A1 (1er–5 juin, 40 %) et le jalon A2 (19 juin,
 * 100 %). La phase B (0 %, 8–12 juin) ⊃ la phase B1 (0 %, 8–12 juin) ⊃ B1a
 * (1er–3 juillet, 50 %).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : « A:0% 2026-06-08→2026-06-12 B:0% … » au lieu de « A:70%
 * 2026-06-01→2026-06-19 B:50% 2026-07-01→2026-07-03 B1:50% … ». Les
 * discriminants passent. */

function jeu(s) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-12',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ImportJsonPhases ${s}`, description: '' },
        tasks: [
            t('A', 0, { isPhase: true }),
            t('A1', 1, { parentId: 'jeu-A', startDate: '2026-06-01', endDate: '2026-06-05', progress: 40 }),
            t('A2', 2, { parentId: 'jeu-A', isMilestone: true, startDate: '2026-06-19', endDate: '2026-06-19', progress: 100 }),
            t('B', 3, { isPhase: true }),
            t('B1', 4, { isPhase: true, parentId: 'jeu-B' }),
            t('B1a', 5, { parentId: 'jeu-B1', startDate: '2026-07-01', endDate: '2026-07-03', progress: 50 }),
        ],
        resources: [],
    };
}

/** « clé:avancement% début→fin » pour chaque clé, lu dans le store. */
async function lire(page, s, cles) {
    return page.evaluate(async ({ s, cles }) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return cles.map(c => {
            const x = store.getTasks().find(t => t.name === `${c} ${s}`);
            return x ? `${c}:${x.progress}% ${x.startDate}→${x.endDate}` : `${c}:absente`;
        }).join(' ');
    }, { s: String(s), cles });
}

test('une phase importée suit ses enfants dès l\'import', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'import-json-phases.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* DISCRIMINANT 1 — LES ENFANTS SONT ARRIVÉS INTACTS : un écart sur les
       phases ne viendrait pas d'enfants mal importés. */
    expect(await lire(page, s, ['A1', 'A2', 'B1a']), 'les enfants importés')
        .toBe('A1:40% 2026-06-01→2026-06-05 A2:100% 2026-06-19→2026-06-19 B1a:50% 2026-07-01→2026-07-03');

    // --- L'ASSERTION CENTRALE ---
    const attendu = 'A:70% 2026-06-01→2026-06-19 B:50% 2026-07-01→2026-07-03 B1:50% 2026-07-01→2026-07-03';
    expect(await lire(page, s, ['A', 'B', 'B1']), 'les phases, dès l\'import').toBe(attendu);
    await expect(page.locator(`.gantt-bar.phase-bar[aria-label^="Phase A ${s}:"]`), 'la barre de A au Gantt')
        .toHaveAttribute('aria-label', `Phase A ${s}: 70% complété`);

    /* TÉMOIN, APRÈS COUP — après rechargement, l'application donne ces
       mêmes valeurs : l'attendu est celui de sa propre règle
       (_loadProjectData), pas une valeur choisie par le test. Il ne court
       qu'au vert ; au rouge, le harnais local l'a mesuré par une sonde
       (A à 70 %, 1er–19 juin, après rechargement). */
    await page.reload();
    await waitForAppReady(page);
    expect(await lire(page, s, ['A', 'B', 'B1']), 'les phases après rechargement').toBe(attendu);

    await deleteActiveProject(page);
});
