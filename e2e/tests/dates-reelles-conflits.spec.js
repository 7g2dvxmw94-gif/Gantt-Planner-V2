import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (conflits de contrainte), sous l'angle des
 * DATES RÉELLES : une tâche commencée n'est plus en conflit de contrainte.
 *
 * LE DÉFAUT, mesuré par une sonde sur main après R2 (#159). Le moteur ancre
 * une tâche commencée sur ses dates réelles : sa contrainte ne la place
 * plus (comme MS Project, où les dates réelles l'emportent). Mais la liste
 * des conflits (conflitsContraintes, utils.js) l'ignore : elle signale
 * encore R, commencée le 17 avec « Doit commencer le 15/06 », comme
 * contrainte « non tenue », et B, commencée le 04 avant la fin de son
 * prédécesseur, comme lien rompu — et « Replacer » sur R ne fait rien
 * (store.replacerTache rend false). Forme « deux implémentations d'une
 * même règle qui divergent » : le moteur dit « le réel l'emporte », la
 * liste dit « la contrainte l'emporte ». Une tâche commencée hors
 * séquence relève du DCMA, pas de la liste des conflits de contrainte.
 *
 * LE JEU, importé, au zoom « jour » :
 *   A  01 → 05/06/2026, prédécesseur (Fin→Début) de B ;
 *   B  « Doit commencer le 04/06 », COMMENCÉE le 04, 04 → 08/06 ;
 *   R  « Doit commencer le 15/06 », COMMENCÉE le 17, 17 → 19/06 ;
 *   N  « Doit commencer le 15/06 », NON commencée, 17 → 19/06 (le témoin :
 *      la liste signale bien une contrainte non tenue).
 * JUIN 2026 COMMENCE UN LUNDI.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : le bouton compte « 3 conflits » au lieu de « 1 conflit ». Les
 * discriminants passent. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesConflits ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-04', '2026-06-08', 1, {
                constraintType: 'MSO', constraintDate: '2026-06-04', actualStart: '2026-06-04',
                progress: 20, status: 'in_progress', dependencies: [{ taskId: 'jeu-a', type: 'FS', lag: 0 }],
            }),
            tache('jeu-r', 'R Réception', '2026-06-17', '2026-06-19', 2, {
                constraintType: 'MSO', constraintDate: '2026-06-15', actualStart: '2026-06-17', progress: 20, status: 'in_progress',
            }),
            tache('jeu-n', 'N Nettoyage', '2026-06-17', '2026-06-19', 3, { constraintType: 'MSO', constraintDate: '2026-06-15' }),
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

/** Dates et Début réel des tâches nommées, lus dans le store VIVANT. */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const une = (n) => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0] : null; };
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: Object.fromEntries(noms.map(n => [n, une(n) ? `${une(n).startDate}→${une(n).endDate} réel ${une(n).actualStart ?? '—'}` : 'introuvable'])),
        };
    }, noms);
}

test('une tâche commencée n\'est plus en conflit de contrainte : ses dates réelles l\'emportent', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, R, N] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dates-reelles-conflits.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE GANTT, AU ZOOM « JOUR » (hérités du compte partagé :
       posés puis relus). Ferme « les repères ne sont pas rendus ». */
    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT — LE JEU EST À SES DATES, réels compris. Ferme « l'import
       a replacé une tâche ou perdu un Début réel » : sans Début réel, B et
       R seraient légitimement en conflit. */
    expect((await lire(page, [A, B, R, N])).dates, 'le jeu importé').toEqual({
        [A]: '2026-06-01→2026-06-05 réel —',
        [B]: '2026-06-04→2026-06-08 réel 2026-06-04',
        [R]: '2026-06-17→2026-06-19 réel 2026-06-17',
        [N]: '2026-06-17→2026-06-19 réel —',
    });

    /* DISCRIMINANT — LA LISTE SIGNALE BIEN UNE CONTRAINTE NON TENUE : le
       repère de N, non commencée, est en conflit. Ferme « plus rien n'est
       jamais signalé ». Passe avant comme après. */
    await expect(ligneDe(page, N).locator('.gantt-contrainte'), 'le repère de N doit être en conflit').toHaveClass(/en-conflit/);

    // --- L'ASSERTION CENTRALE ---
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'le bouton doit compter 1 conflit : N seule, pas B ni R, commencées').toHaveAttribute('aria-label', '1 conflit');
    for (const n of [B, R]) {
        await expect(ligneDe(page, n).locator('.gantt-contrainte'), `le repère de « ${n} », commencée, n'est pas en conflit`).not.toHaveClass(/en-conflit/);
    }
    await conflitsBtn.click();
    const liste = page.locator('#conflitsModal [role="dialog"]');
    await expect(liste, 'la liste des conflits doit s\'ouvrir').toBeVisible();
    const lignes = liste.locator('.conflit-ligne');
    await expect(lignes, 'une seule ligne : celle de N').toHaveCount(1);
    await expect(lignes.first(), 'la ligne est celle de N').toContainText(N);
    await page.keyboard.press('Escape');
    await expect(page.locator('#conflitsModal'), 'la liste doit se fermer').toHaveCount(0);

    await deleteActiveProject(page);
});
