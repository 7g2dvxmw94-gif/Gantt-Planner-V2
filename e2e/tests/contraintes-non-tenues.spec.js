import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (contraintes de date) : une contrainte non
 * tenue est signalée.
 *
 * LE BESOIN. Après un placement, une tâche tient toujours sa contrainte :
 * le moteur l'y met. Mais des dates peuvent arriver sans placement : un
 * import, un changement de calendrier, l'écriture d'un collègue resté sur
 * l'ancien code. La tâche viole alors sa propre contrainte, et rien ne le
 * dit. La PR précédente ne signale que les liens rompus.
 *
 * LE JEU, importé par le bouton « Importer » (l'import garde les dates du
 * fichier, sans les replacer — discriminant D1) :
 *   R  racine, « Doit commencer le » 15/06 (MSO), importée 17 → 19/06 :
 *      la contrainte n'est pas tenue ;
 *   S  TÉMOIN, racine, « Doit commencer le » 15/06, importée 15 → 17/06 :
 *      tenue.
 *
 * L'ATTENDU. Le bouton « ⚠ 1 conflit » ; la liste a une ligne, celle de R,
 * qui dit « non tenue », la date exigée 15/06/2026 et la date tenue
 * 17/06/2026. Le repère de R est en conflit, pas celui de S.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « contrainte non tenue de R non comptée ». Les discriminants
 * passent. JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesNonTenues ${suffixe}`, description: '' },
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

test('une contrainte non tenue est signalée : bouton, ligne « non tenue » et repère', async ({ page }) => {
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
        name: 'contraintes-non-tenues.json',
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

    // --- L'ASSERTION CENTRALE ---
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'contrainte non tenue de R non comptée').toBeVisible();
    await expect(conflitsBtn, 'le bouton doit compter 1 conflit').toHaveAttribute('aria-label', '1 conflit');
    await expect(ligneDe(page, R).locator('.gantt-contrainte'), 'le repère de R doit être en conflit').toHaveClass(/en-conflit/);
    await expect(ligneDe(page, S).locator('.gantt-contrainte'), 'le repère de S n\'est pas en conflit').not.toHaveClass(/en-conflit/);

    await conflitsBtn.click();
    const liste = page.locator('#conflitsModal [role="dialog"]');
    await expect(liste, 'la liste des conflits doit s\'ouvrir').toBeVisible();
    const lignes = liste.locator('.conflit-ligne');
    await expect(lignes, 'une seule ligne : celle de R, pas celle de S').toHaveCount(1);
    for (const attendu of [R, 'Doit commencer le 15/06/2026', 'non tenue', '15/06/2026', '17/06/2026']) {
        await expect(lignes.first(), `la ligne de R doit dire « ${attendu} »`).toContainText(attendu);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#conflitsModal'), 'la liste doit se fermer').toHaveCount(0);

    await deleteActiveProject(page);
});
