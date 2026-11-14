import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer), sous l'angle des
 * CONTRAINTES DE DATE SOUPLES (« au plus tôt / au plus tard ») :
 * décision 7 de l'utilisateur, « la date suit seulement si elle bloque, et
 * jamais au prix d'un lien rompu ».
 *
 * LA RÈGLE (plan v4, § 3.3 règle 5). La date d'une SNET, SNLT, FNET ou
 * FNLT glissée par son bout visé prend le bord affiché (ramené comme la
 * date effective) seulement si (i) la contrainte inchangée empêcherait le
 * bout d'y aller, (ii) la nouvelle date l'y met, et (iii) cela ne rompt
 * aucun lien de plus. Sinon la contrainte reste.
 *
 * LE JEU : R et R' racines SNET 10/06 (10 → 12) ; A 01 → 05 ; B
 * Fin→Début de A, SNLT 12/06 (08 → 10) ; B2 Fin→Début de A, FNLT 12/06
 * (08 → 10) ; F racine FNLT 12/06 (10 → 12) ; W témoin.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « R : 10 → 12 au lieu de 08 → 10 ». Les discriminants passent.
 * JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesSouples ${nomJeu} ${suffixe}`, description: '' },
        tasks: [['jeu-w', 'W Témoin', '2026-06-05', '2026-06-09'], ...taches].map(tache),
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** L'identifiant d'une tâche, lu dans le store par son nom (le compte est
 *  partagé : on filtre par nom, et il en faut exactement une). */
async function idDe(page, nom) {
    const ids = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getTasks().filter(t => t.name === nom).map(t => t.id);
    }, nom);
    expect(ids, `une seule tâche « ${nom} »`).toHaveLength(1);
    return ids[0];
}
/* La barre ou le losange : un jalon ne porte pas son nom. */
const barreDe = async (page, nom) => page.locator(`.gantt-timeline-cell [data-task-id="${await idDe(page, nom)}"]`);
const ligneDe = async (page, nom) => page.locator(`.gantt-row[data-task-id="${await idDe(page, nom)}"]`);

/** Dates et contrainte des tâches nommées, lues dans le store VIVANT. */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            pile: store._undoStack ? store._undoStack.length : null,
            etat: Object.fromEntries(noms.map(n => {
                const t = taches.filter(x => x.name === n);
                if (t.length !== 1) return [n, `${t.length} tâche(s)`];
                const c = t[0].constraintType ? ` ${t[0].constraintType} ${t[0].constraintDate}` : '';
                return [n, `${t[0].startDate}→${t[0].endDate}${c}`];
            })),
        };
    }, noms);
}

/** Importe le jeu, attend le projet actif, puis pose et relit la vue Gantt
 *  au zoom « jour » (relu des réglages du compte partagé). */
async function monter(page, donnees, fichier) {
    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: fichier, mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT D1 — LE GANTT, AU ZOOM « JOUR ». Ferme « une colonne
       n'est pas un jour » : le nombre de colonnes glissées ne dirait rien. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);
}

/** Largeur d'une colonne, lue dans le DOM. */
const largeurColonne = async (page) => (await present(page.locator('.gantt-timeline-grid-col').first(),
    'colonne de la grille du Gantt')).evaluate(el => el.getBoundingClientRect().width);

/** Glisse la barre (ou une poignée) de `colonnes` colonnes. `prise` :
 *  'centre', 'gauche' ou 'droite'. Rend de combien de colonnes le bord
 *  gauche et le bord droit de la barre ont suivi la souris AVANT le lâcher. */
async function glisser(page, nom, colonnes, prise = 'centre') {
    const barre = await present(await barreDe(page, nom), `barre de « ${nom} »`);
    await barre.scrollIntoViewIfNeeded();
    const largeur = await largeurColonne(page);
    const bords = () => barre.evaluate(el => ({ g: parseFloat(el.style.left), d: parseFloat(el.style.left) + parseFloat(el.style.width) }));
    const avant = await bords();
    const boite = await barre.boundingBox();
    const x = prise === 'gauche' ? boite.x + 2 : prise === 'droite' ? boite.x + boite.width - 2 : boite.x + boite.width / 2;
    const y = boite.y + boite.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + colonnes * largeur, y, { steps: 10 });
    const pendant = await bords();
    await page.mouse.up();
    return { gauche: (pendant.g - avant.g) / largeur, droite: (pendant.d - avant.d) / largeur, largeur, pendant };
}

const W_ATTENDU = '2026-06-05→2026-06-09';
const fs = (taskId) => ({ dependencies: [{ taskId, type: 'FS', lag: 0 }] });
const fenetre = (page) => page.locator('[role="alertdialog"][aria-modal="true"]');

test('glisser une contrainte souple : la date suit seulement si elle bloque, et jamais au prix d\'un lien', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Souples', [
        ['jeu-r', 'R Clôture', '2026-06-10', '2026-06-12', { constraintType: 'SNET', constraintDate: '2026-06-10' }],
        ['jeu-r2', 'R2 Portail', '2026-06-10', '2026-06-12', { constraintType: 'SNET', constraintDate: '2026-06-10' }],
        ['jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05'],
        ['jeu-b', 'B Fondations', '2026-06-08', '2026-06-10', { ...fs('jeu-a'), constraintType: 'SNLT', constraintDate: '2026-06-12' }],
        ['jeu-b2', 'B2 Réseaux', '2026-06-08', '2026-06-10', { ...fs('jeu-a'), constraintType: 'FNLT', constraintDate: '2026-06-12' }],
        ['jeu-f', 'F Façade', '2026-06-10', '2026-06-12', { constraintType: 'FNLT', constraintDate: '2026-06-12' }],
    ]);
    const [W, R, R2, , B, B2, F] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-souples.json');
    expect((await lire(page, [W, R, R2, B, B2, F])).etat, 'le jeu importé').toEqual({
        [W]: W_ATTENDU,
        [R]: '2026-06-10→2026-06-12 SNET 2026-06-10', [R2]: '2026-06-10→2026-06-12 SNET 2026-06-10',
        [B]: '2026-06-08→2026-06-10 SNLT 2026-06-12', [B2]: '2026-06-08→2026-06-10 FNLT 2026-06-12',
        [F]: '2026-06-10→2026-06-12 FNLT 2026-06-12',
    });

    /* DISCRIMINANT D1 — UNE LIMITE NON FRANCHIE N'EST PAS DÉPLACÉE : R2
       (SNET 10/06) +5 → 15 → 17/06, SNET 10/06 inchangée. */
    await glisser(page, R2, 5);
    await expect.poll(async () => (await lire(page, [R2])).etat[R2], { message: 'R2 : 15 → 17, SNET 10 inchangée' })
        .toBe('2026-06-15→2026-06-17 SNET 2026-06-10');

    /* DISCRIMINANT D2 — SUIVRE ROMPRAIT UN LIEN : B (SNLT 12/06, liée à A)
       −5 → revient à 08 → 10/06, SNLT 12/06, sans fenêtre ni conflit. */
    await glisser(page, B, -5);
    await expect.poll(async () => (await lire(page, [B])).etat[B], { message: 'B : revient, SNLT 12 inchangée' })
        .toBe('2026-06-08→2026-06-10 SNLT 2026-06-12');
    await expect(fenetre(page), 'aucune fenêtre pour B').toHaveCount(0);
    await expect(page.locator('#conflitsBtn'), 'aucun conflit').toBeHidden();

    /* DISCRIMINANT D4 — LA FENÊTRE DE LA PR PRÉCÉDENTE TIENT : B2 (FNLT
       12/06, liée à A) étirée par le bord gauche de 6 colonnes ouvre la
       fenêtre ; « Annuler » la rend à 08 → 10/06. */
    await glisser(page, B2, -6, 'gauche');
    await expect(fenetre(page), 'la fenêtre s\'ouvre pour B2').toBeVisible();
    await fenetre(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetre(page)).toHaveCount(0);
    expect((await lire(page, [B2])).etat[B2], 'B2 inchangée').toBe('2026-06-08→2026-06-10 FNLT 2026-06-12');

    // --- L'ASSERTION CENTRALE ---
    /* R (SNET 10/06) −2 : la limite bloquait, elle suit → 08 → 10/06. */
    await glisser(page, R, -2);
    await expect.poll(async () => (await lire(page, [R])).etat[R], { message: 'R : 10 → 12 au lieu de 08 → 10' })
        .toBe('2026-06-08→2026-06-10 SNET 2026-06-08');
    /* F (FNLT 12/06) +8, bord droit lâché le samedi 20 → vendredi 19. */
    await glisser(page, F, 8);
    await expect.poll(async () => (await lire(page, [F])).etat[F], { message: 'F : 17 → 19, « Fin au plus tard le 19/06 »' })
        .toBe('2026-06-17→2026-06-19 FNLT 2026-06-19');
    expect((await lire(page, [W])).etat[W]).toBe(W_ATTENDU);

    await deleteActiveProject(page);
});
