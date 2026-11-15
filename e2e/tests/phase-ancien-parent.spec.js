import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B2 (phases) : l'ancienne phase est recalculée
 * quand une tâche change de parent.
 *
 * LE DÉFAUT. updateTask (store.js) recalcule la phase de la tâche APRÈS
 * l'écriture, donc la NOUVELLE. L'ancienne garde ses dates et son
 * avancement, calculés avec un enfant qu'elle n'a plus. Une tâche à 100 %
 * qui quitte P1 laisse P1 à 50 % alors que ses enfants restants sont à
 * 0 %.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « Phase P1: 50% complété » au lieu de 0 %. Les discriminants
 * passent. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E PhaseAncienParent ${nomJeu} ${suffixe}`, description: '' },
        tasks: taches.map(tache),
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const une = (n) => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0] : null; };
        return {
            projet: store.getActiveProject()?.name ?? null,
            parents: Object.fromEntries(noms.map(n => [n, une(n) ? ((taches.find(x => x.id === une(n).parentId) || {}).name ?? null) : 'introuvable'])),
            ordres: noms.map(n => `${n.split(' ')[0]}:${une(n) ? une(n).order : '?'}`).join(' '),
        };
    }, noms);
}

async function importer(page, donnees, fichier) {
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({ name: fichier, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
}

/** Le nom accessible de la barre de phase : « Phase <nom>: N% complété ». */
const phase = (page, nom) => page.locator(`.phase-bar[aria-label^="Phase ${nom}:"]`);

test('une tâche qui change de phase fait recalculer l\'ancienne phase', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Parent', [
        ['jeu-p1', 'P1 Gros œuvre', '2026-06-01', '2026-06-12', { isPhase: true, progress: 50 }],
        ['jeu-x', 'X Semelles', '2026-06-01', '2026-06-05', { parentId: 'jeu-p1', progress: 100 }],
        ['jeu-y', 'Y Murs', '2026-06-08', '2026-06-12', { parentId: 'jeu-p1' }],
        ['jeu-p2', 'P2 Second œuvre', '2026-06-15', '2026-06-19', { isPhase: true }],
        ['jeu-z', 'Z Cloisons', '2026-06-15', '2026-06-19', { parentId: 'jeu-p2' }],
    ]);
    const [P1, X, Y, P2, Z] = donnees.tasks.map(t => t.name);
    await page.goto('index.html');
    await waitForAppReady(page);
    await importer(page, donnees, 'phase-ancien-parent.json');
    expect((await lire(page, [X, Y, Z])).parents, 'l\'arborescence importée').toEqual({ [X]: P1, [Y]: P1, [Z]: P2 });
    await expect(await present(phase(page, P1), `barre de « ${P1} »`), 'P1 importée à 50 %').toHaveAttribute('aria-label', `Phase ${P1}: 50% complété`);

    /* X passe sous P2 par la liste « Phase parente » de la fiche. */
    const barreX = await present(page.locator('.gantt-bar[data-task-id]:not(.phase-bar)').filter({ hasText: X }), `barre de « ${X} »`);
    await barreX.dblclick();
    await expect(page.locator('#taskName'), 'la fiche de X').toHaveValue(X);
    const p2Id = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getTasks().find(t => t.name === nom).id;
    }, P2);
    await page.locator('#taskParent').selectOption(p2Id);
    await (await present(page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT 1 — LA FICHE A DÉPLACÉ X sous P2. */
    expect((await lire(page, [X])).parents[X], 'X est sous P2').toBe(P2);
    /* DISCRIMINANT 2 — LA NOUVELLE PHASE EST RECALCULÉE : P2 (X 100 %, Z
       0 %) à 50 %. Ferme « aucun recalcul n'a lieu dans ce montage ». */
    await expect(await present(phase(page, P2), `barre de « ${P2} »`), 'P2 recalculée').toHaveAttribute('aria-label', `Phase ${P2}: 50% complété`);

    // --- L'ASSERTION CENTRALE ---
    /* P1 n'a plus que Y (0 %) : 0 %. */
    await expect(await present(phase(page, P1), `barre de « ${P1} »`), 'P1, l\'ancienne phase, recalculée').toHaveAttribute('aria-label', `Phase ${P1}: 0% complété`);

    await deleteActiveProject(page);
});
