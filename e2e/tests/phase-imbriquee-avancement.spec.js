import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B2 (phases) : une phase grand-parente suit
 * l'avancement de ses petits-enfants.
 *
 * LE DÉFAUT. _recalculatePhase (store.js) recalcule les dates et
 * l'avancement d'une phase d'après ses ENFANTS DIRECTS, puis s'arrête :
 * il ne remonte pas à la phase parente. Quand X, sous P2 sous P1, passe à
 * 100 %, P2 suit (100 %) mais P1 garde l'avancement d'avant. Au
 * chargement, les phases sont recalculées dans l'ordre du tableau : si
 * P0 précède sa sous-phase P1, P0 est calculée sur l'ancienne valeur de
 * P1, et reste fausse.
 *
 * Le WBS (numérotation, organigramme) affichera l'avancement de chaque
 * niveau : ce défaut y serait visible à chaque phase imbriquée.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 2 failed, les tests 1 et 2, sur
 * leur assertion centrale (« Phase P1: 0% complété », puis « Phase P0: 0%
 * complété »). Le test 3, garde contre une boucle de parents, passe avant
 * comme après. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E PhaseImbriquee ${nomJeu} ${suffixe}`, description: '' },
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

test('une phase grand-parente suit l\'avancement d\'un petit-enfant modifié par la fiche', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Fiche', [
        ['jeu-p1', 'P1 Gros œuvre', '2026-06-01', '2026-06-05', { isPhase: true }],
        ['jeu-p2', 'P2 Fondations', '2026-06-01', '2026-06-05', { isPhase: true, parentId: 'jeu-p1' }],
        ['jeu-x', 'X Semelles', '2026-06-01', '2026-06-05', { parentId: 'jeu-p2' }],
    ]);
    const [P1, P2, X] = donnees.tasks.map(t => t.name);
    await page.goto('index.html');
    await waitForAppReady(page);
    await importer(page, donnees, 'phase-imbriquee-1.json');
    expect((await lire(page, [P1, P2, X])).parents, 'l\'arborescence importée').toEqual({ [P1]: null, [P2]: P1, [X]: P2 });

    /* X passe à 100 % par la fiche. */
    const barreX = await present(page.locator('.gantt-bar[data-task-id]:not(.phase-bar)').filter({ hasText: X }), `barre de « ${X} »`);
    await barreX.dblclick();
    await expect(page.locator('#taskName'), 'la fiche de X').toHaveValue(X);
    await page.locator('#taskProgress').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await (await present(page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT 1 — LA FICHE A ÉCRIT : la barre de X dit 100 %. */
    await expect(barreX, 'X est à 100 %').toHaveAttribute('aria-label', /100%/);
    /* DISCRIMINANT 2 — LE PARENT DIRECT SUIT : P2 à 100 %. Ferme « X n'est
       pas sous P2 », « aucun recalcul n'a lieu ». */
    await expect(await present(phase(page, P2), `barre de « ${P2} »`), 'P2 suit X').toHaveAttribute('aria-label', `Phase ${P2}: 100% complété`);

    // --- L'ASSERTION CENTRALE ---
    await expect(await present(phase(page, P1), `barre de « ${P1} »`), 'P1, grand-parent, suit aussi').toHaveAttribute('aria-label', `Phase ${P1}: 100% complété`);

    await deleteActiveProject(page);
});

test('au chargement, une phase est recalculée après ses sous-phases, quel que soit l\'ordre', async ({ page }) => {
    const s = Date.now();
    /* L'ordre du tableau est l'ordre de l'arbre : P0 précède sa sous-phase
       P1, qui précède P2. Les avancements enregistrés sont périmés pour P0
       et P1 (0 %), justes pour P2 et X (100 %). */
    const donnees = jeu(s, 'Chargement', [
        ['jeu-p0', 'P0 Bâtiment', '2026-06-01', '2026-06-05', { isPhase: true }],
        ['jeu-p1', 'P1 Gros œuvre', '2026-06-01', '2026-06-05', { isPhase: true, parentId: 'jeu-p0' }],
        ['jeu-p2', 'P2 Fondations', '2026-06-01', '2026-06-05', { isPhase: true, parentId: 'jeu-p1', progress: 100 }],
        ['jeu-x', 'X Semelles', '2026-06-01', '2026-06-05', { parentId: 'jeu-p2', progress: 100 }],
    ]);
    const [P0, P1, P2, X] = donnees.tasks.map(t => t.name);
    await page.goto('index.html');
    await waitForAppReady(page);
    await importer(page, donnees, 'phase-imbriquee-2.json');

    /* DISCRIMINANT 1 — L'ORDRE DE CHARGEMENT EST CELUI DE L'ARBRE : P0
       avant P1 avant P2. Ferme « l'ordre est déjà un post-ordre, et main
       recalculerait juste ». */
    expect((await lire(page, [P0, P1, P2, X])).ordres, 'les ordres').toBe(`P0:0 P1:1 P2:2 X:3`);

    await page.reload();
    await waitForAppReady(page);
    await expect.poll(async () => (await lire(page, [])).projet, { message: 'le projet reste actif après rechargement', timeout: 15_000 }).toBe(donnees.project.name);

    /* DISCRIMINANT 2 — LE RECHARGEMENT A RECALCULÉ : P1, enregistrée à
       0 %, est relue à 100 %. Ferme « le test lit le fichier ». */
    await expect(await present(phase(page, P1), `barre de « ${P1} »`), 'P1 recalculée').toHaveAttribute('aria-label', `Phase ${P1}: 100% complété`);

    // --- L'ASSERTION CENTRALE ---
    await expect(await present(phase(page, P0), `barre de « ${P0} »`), 'P0, recalculée après P1').toHaveAttribute('aria-label', `Phase ${P0}: 100% complété`);

    await deleteActiveProject(page);
});

test('garde : une boucle de parents n\'emballe pas le recalcul', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Boucle', [
        ['jeu-l1', 'L1 Boucle', '2026-06-01', '2026-06-05', { isPhase: true, parentId: 'jeu-l2' }],
        ['jeu-l2', 'L2 Boucle', '2026-06-01', '2026-06-05', { isPhase: true, parentId: 'jeu-l1' }],
        ['jeu-e', 'E Enfant', '2026-06-01', '2026-06-05', { parentId: 'jeu-l1' }],
    ]);
    const [L1, L2, E] = donnees.tasks.map(t => t.name);
    await page.goto('index.html');
    await waitForAppReady(page);
    await importer(page, donnees, 'phase-imbriquee-3.json');

    /* DISCRIMINANT — LA BOUCLE EST LÀ : L1 → L2 → L1, E sous L1. Ferme
       « l'import a cassé la boucle, la garde n'est pas exercée ». */
    expect((await lire(page, [L1, L2, E])).parents, 'la boucle importée').toEqual({ [L1]: L2, [L2]: L1, [E]: L1 });

    /* LA GARDE : l'écriture rend la tâche, sans débordement de pile. */
    const resultat = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const e = store.getTasks().find(t => t.name === nom);
        try { const r = store.updateTask(e.id, { progress: 50 }); return r ? 'objet' : String(r); }
        catch (err) { return `${err.name}: ${err.message}`; }
    }, E);
    expect(resultat, 'updateTask rend la tâche').toBe('objet');

    await deleteActiveProject(page);
});
