import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (contraintes de date) : un message prévient
 * quand une action de l'utilisateur fait apparaître un conflit.
 *
 * LE BESOIN. Le bouton « ⚠ N conflits » compte les conflits, mais ne dit
 * pas qu'on vient d'en créer un. Sur 1 000 lignes, la tâche touchée est
 * souvent hors de l'écran : l'utilisateur enregistre, et ne voit rien.
 *
 * LE JEU, importé par le bouton « Importer » :
 *   W  01 → 05/06 ;  X  Fin→Début de W, MSO 04/06, placée 04 → 08/06 :
 *      un conflit PRÉEXISTANT ;
 *   A  01 → 05/06 ;  B  Fin→Début de A, MSO 08/06, placée 08 → 10/06 :
 *      contrainte tenue, lien tenu.
 * Puis, dans la fiche de A : 01 → 09/06. A exige alors le 10, B tient le
 * 08 : un conflit APPARAÎT.
 *
 * L'ATTENDU. Un toast d'avertissement nomme B et A ; le bouton passe à
 * 2. Ctrl+Z le ramène à 1, Ctrl+Y (Rétablir) à 2 — sans nouveau toast :
 * annuler et rétablir ne sont pas des actions qui créent un conflit.
 *
 * Un compteur (MutationObserver sur #toastContainer, posé avant l'import)
 * compte les toasts d'avertissement ajoutés.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « toast de conflit absent ». Les discriminants passent.
 * JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const fs = (taskId) => [{ taskId, type: 'FS', lag: 0 }];
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesConflitToast ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-w', 'W Démolition', '2026-06-01', '2026-06-05', 0),
            tache('jeu-x', 'X Désamiantage', '2026-06-04', '2026-06-08', 1, {
                dependencies: fs('jeu-w'), constraintType: 'MSO', constraintDate: '2026-06-04',
            }),
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 2),
            tache('jeu-b', 'B Fondations', '2026-06-08', '2026-06-10', 3, {
                dependencies: fs('jeu-a'), constraintType: 'MSO', constraintDate: '2026-06-08',
            }),
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

const fiche = (page) => page.locator('#taskModalOverlay');

/** Ouvre la fiche d'une tâche par un double-clic sur sa barre, modifie
 *  ce que `remplir` modifie, enregistre, et attend la fermeture. */
async function parLaFiche(page, nom, remplir) {
    await (await present(barreDe(page, nom), `barre de « ${nom} »`)).dblclick();
    await expect(page.locator('#taskName'), `la fiche ouverte est celle de « ${nom} »`).toHaveValue(nom);
    await remplir();
    await (await present(fiche(page).getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(fiche(page), `la fiche de « ${nom} » doit se fermer`).toBeHidden({ timeout: 15_000 });
}

test('un toast prévient quand l\'utilisateur fait apparaître un conflit, et pas à l\'import, ni à l\'annulation ou au rétablissement', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [W, X, A, B] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    /* Le compteur, posé AVANT l'import : chaque .toast-warning ajouté. */
    await page.evaluate(() => {
        window.__toastsConflit = 0;
        const conteneur = document.querySelector('#toastContainer');
        new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
            if (n.nodeType === 1 && n.classList.contains('toast-warning')) window.__toastsConflit++;
        }))).observe(conteneur, { childList: true });
    });
    const compteur = () => page.evaluate(() => window.__toastsConflit);

    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'contraintes-conflit-toast.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    const lu = await lire(page, [W, X, A, B]);
    expect(lu.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [W]: '2026-06-01→2026-06-05', [X]: '2026-06-04→2026-06-08',
        [A]: '2026-06-01→2026-06-05', [B]: '2026-06-08→2026-06-10',
    });

    /* DISCRIMINANT D0 — L'IMPORT D'UN FICHIER QUI PORTE UN CONFLIT ne
       déclenche aucun toast de conflit, et le bouton le compte. Ferme « le
       toast suit la présence d'un conflit » : il partirait ici. */
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'le conflit préexistant de X est compté').toHaveAttribute('aria-label', '1 conflit');
    expect(await compteur(), 'aucun toast de conflit à l\'import').toBe(0);

    /* DISCRIMINANT D2 — UN ENREGISTREMENT QUI NE CRÉE PAS DE CONFLIT (W
       renommée par sa fiche) donne « Tâche mise à jour », et aucun toast
       de conflit. Ferme « le toast part à chaque enregistrement, dès qu'il
       existe un conflit ». */
    const W2 = `${W} bis`;
    await parLaFiche(page, W, async () => { await page.locator('#taskName').fill(W2); });
    await expect(page.locator('#toastContainer .toast', { hasText: 'Tâche mise à jour' }).last(),
        'l\'enregistrement de W doit aller à son terme').toBeVisible();
    expect(await compteur(), 'aucun toast de conflit pour un enregistrement qui n\'en crée pas').toBe(0);
    await expect(conflitsBtn).toHaveAttribute('aria-label', '1 conflit');

    // --- L'ASSERTION CENTRALE ---
    await parLaFiche(page, A, async () => { await page.locator('#taskEnd').fill('2026-06-09'); });
    expect((await lire(page, [A, B])).dates, 'A finit le 09, B tient sa contrainte').toEqual({
        [A]: '2026-06-01→2026-06-09', [B]: '2026-06-08→2026-06-10',
    });
    const toast = page.locator('#toastContainer .toast-warning');
    await expect(toast, 'toast de conflit absent').toHaveCount(1);
    await expect(toast, 'le toast nomme B').toContainText(B);
    await expect(toast, 'le toast nomme A, le prédécesseur').toContainText(A);
    await expect(conflitsBtn, 'le bouton compte le nouveau conflit').toHaveAttribute('aria-label', '2 conflits');
    expect(await compteur(), 'un seul toast de conflit').toBe(1);

    /* Annuler puis rétablir : le conflit s'en va et revient, sans toast. */
    await page.keyboard.press('Control+z');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' }).last()).toBeVisible();
    await expect(conflitsBtn, 'Ctrl+Z retire le conflit apparu').toHaveAttribute('aria-label', '1 conflit');
    await page.keyboard.press('Control+y');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action rétablie' }).last()).toBeVisible();
    await expect(conflitsBtn, 'Rétablir le ramène').toHaveAttribute('aria-label', '2 conflits');
    expect(await compteur(), 'ni l\'annulation ni le rétablissement ne donnent de toast de conflit').toBe(1);

    await deleteActiveProject(page);
});
