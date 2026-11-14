import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (contraintes de date) : « Replacer » remet une
 * tâche sur sa contrainte, en un geste annulable.
 *
 * LE BESOIN. La liste des conflits dit qu'une contrainte n'est pas tenue
 * (PR précédente), mais n'offre rien pour la tenir : il faut ouvrir la
 * fiche et retaper la date. « Replacer » place la tâche comme le ferait
 * un enregistrement, et Ctrl+Z doit l'annuler — le placement seul
 * (applyPredecessorConstraints) ne prend pas d'instantané.
 *
 * LE JEU (celui de contraintes-non-tenues.spec.js), importé :
 *   R  racine, « Doit commencer le » 15/06 (MSO), importée 17 → 19/06 ;
 *   S  TÉMOIN, même contrainte, importée 15 → 17/06 (tenue).
 *
 * L'ATTENDU. La ligne de R porte un bouton « Replacer ». Un clic relit R
 * 15 → 17/06 et le bouton des conflits disparaît. Ctrl+Z relit R
 * 17 → 19/06 et le bouton revient.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « bouton Replacer absent de la ligne de R ». Les
 * discriminants passent. JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesReplacer ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-r', 'R Réception', '2026-06-17', '2026-06-19', 0, { constraintType: 'MSO', constraintDate: '2026-06-15' }),
            tache('jeu-s', 'S Livraison', '2026-06-15', '2026-06-17', 1, { constraintType: 'MSO', constraintDate: '2026-06-15' }),
        ],
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const barreDe = (page, nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
const ligneDe = (page, nom) => page.locator('.gantt-row').filter({ has: barreDe(page, nom) });

/** Dates et identifiants des tâches nommées, lus dans le store VIVANT,
 *  filtrés par nom (le compte est partagé). */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const une = (n) => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0] : null; };
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: Object.fromEntries(noms.map(n => [n, une(n) ? `${une(n).startDate}→${une(n).endDate}` : 'introuvable'])),
            ids: Object.fromEntries(noms.map(n => [n, une(n)?.id ?? null])),
        };
    }, noms);
}

test('« Replacer » remet une tâche sur sa contrainte, et Ctrl+Z l\'annule', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [R, S] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'contraintes-replacer.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE GANTT, AU ZOOM « JOUR » (relu des réglages du
       compte partagé : posé puis relu). Ferme « les repères ne sont pas
       rendus ». */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT D1 — R EST RESTÉE 17 → 19/06. Ferme « l'import replace
       déjà la tâche » : R tiendrait alors sa contrainte et il n'y aurait
       rien à signaler. */
    /* DISCRIMINANT D2 — LE TÉMOIN S EST À 15 → 17/06 et tient sa
       contrainte. Ferme « toute MSO serait déclarée non tenue » :
       l'assertion centrale exige ensuite qu'elle ne soit pas listée. */
    const lu = await lire(page, [R, S]);
    expect(lu.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [R]: '2026-06-17→2026-06-19', [S]: '2026-06-15→2026-06-17',
    });
    for (const n of [R, S]) await present(barreDe(page, n), `barre de « ${n} »`);

    /* DISCRIMINANT D3 — LA LIGNE « NON TENUE » DE R EST LÀ (PR
       précédente), et elle seule. Ferme « le rouge viendrait de la ligne
       absente, et non du bouton ». */
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'le bouton des conflits doit compter 1 conflit').toHaveAttribute('aria-label', '1 conflit');
    await conflitsBtn.click();
    const liste = page.locator('#conflitsModal [role="dialog"]');
    await expect(liste, 'la liste des conflits doit s\'ouvrir').toBeVisible();
    const lignes = liste.locator('.conflit-ligne');
    await expect(lignes, 'une seule ligne : celle de R').toHaveCount(1);
    await expect(lignes.first(), 'la ligne de R dit « non tenue »').toContainText('non tenue');
    await expect(lignes.first()).toContainText(R);

    // --- L'ASSERTION CENTRALE ---
    const replacer = lignes.first().getByRole('button', { name: 'Replacer' });
    await expect(replacer, 'bouton Replacer absent de la ligne de R').toHaveCount(1);
    await replacer.click();
    await expect.poll(async () => (await lire(page, [R])).dates[R],
        { message: '« Replacer » doit remettre R au 15 → 17/06' }).toBe('2026-06-15→2026-06-17');
    await expect(conflitsBtn, 'R tient sa contrainte : plus de conflit, plus de bouton').toBeHidden();
    await expect(page.locator('#conflitsModal'), 'la liste se ferme quand le dernier conflit disparaît').toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await lire(page, [R])).dates[R],
        { message: 'Ctrl+Z doit annuler « Replacer » : R revient au 17 → 19/06' }).toBe('2026-06-17→2026-06-19');
    await expect(conflitsBtn, 'le conflit revient avec Ctrl+Z').toHaveAttribute('aria-label', '1 conflit');

    await deleteActiveProject(page);
});
