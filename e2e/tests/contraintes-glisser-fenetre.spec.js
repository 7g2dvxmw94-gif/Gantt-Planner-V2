import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer), sous l'angle des
 * CONTRAINTES DE DATE : une fenêtre demande confirmation avant qu'un
 * glisser rompe un lien (décision 8 de l'utilisateur).
 *
 * LE BESOIN. Depuis la PR précédente, glisser une « Doit commencer le »
 * emmène sa date. Glissée avant ce qu'exige son prédécesseur, elle rompt
 * le lien — la contrainte l'emporte — sans rien demander.
 *
 * LA RÈGLE (plan v4, § 3.3 règle 6, § 3.4). Au lâcher, le placement FINAL
 * de la tâche glissée est calculé sans rien écrire. S'il rompt un lien
 * entrant qui tenait avant le glisser, une fenêtre « Rompre un lien ? »
 * (alertdialog, aria-modal) le dit et attend : « Annuler » (le focus y
 * est ; Échap aussi) n'écrit rien ; « Continuer quand même » écrit,
 * exactement comme sans fenêtre. Une contrainte souple, une tâche sans
 * contrainte, ou un glisser qui ne rompt rien n'ouvrent jamais la fenêtre.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 2 failed, chacun « fenêtre de
 * confirmation absente » sur son glisser central (B est écrite sans
 * question). Les discriminants passent. JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesFenetre ${nomJeu} ${suffixe}`, description: '' },
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

test('glisser une « Doit commencer le » avant son prédécesseur : la fenêtre demande, « Annuler » n\'écrit rien, « Continuer » écrit', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'MSO', [
        ['jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05'],
        ['jeu-b', 'B Fondations', '2026-06-15', '2026-06-17', { ...fs('jeu-a'), constraintType: 'MSO', constraintDate: '2026-06-15' }],
        ['jeu-c', 'C Réseaux', '2026-06-10', '2026-06-12', { ...fs('jeu-a'), constraintType: 'SNET', constraintDate: '2026-06-10' }],
        ['jeu-r', 'R Réception', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }],
        ['jeu-x', 'X Désamiantage', '2026-06-11', '2026-06-15', { ...fs('jeu-c'), constraintType: 'MSO', constraintDate: '2026-06-11' }],
    ]);
    const [W, A, B, C, R, X] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-fenetre-1.json');
    expect((await lire(page, [W, B, C, R])).etat, 'le jeu importé').toEqual({
        [W]: W_ATTENDU, [B]: '2026-06-15→2026-06-17 MSO 2026-06-15',
        [C]: '2026-06-10→2026-06-12 SNET 2026-06-10', [R]: '2026-06-15→2026-06-17 MSO 2026-06-15',
    });
    expect((await lire(page, [X])).etat[X], 'X importée').toBe('2026-06-11→2026-06-15 MSO 2026-06-11');
    await expect(page.locator('#conflitsBtn'), 'X arrive avec son lien déjà rompu').toHaveAttribute('aria-label', '1 conflit');

    /* DISCRIMINANT D1 — UN GLISSER QUI NE ROMPT RIEN : R, sans lien, +4 →
       19 → 23/06, « Doit commencer le 19/06 », et aucune fenêtre. Ferme
       « la base ne suit pas la souris (et le rouge viendrait de là) » et
       « la fenêtre s'ouvre à tout glisser d'une contrainte dure ». */
    await glisser(page, R, 4);
    await expect.poll(async () => (await lire(page, [R])).etat[R], { message: 'R suit la souris' })
        .toBe('2026-06-19→2026-06-23 MSO 2026-06-19');
    await expect(fenetre(page), 'aucune fenêtre pour R').toHaveCount(0);

    /* DISCRIMINANT D2 — UNE CONTRAINTE SOUPLE : C (SNET 10/06, liée à A)
       −6 → revient à 10 → 12/06, aucune fenêtre. Ferme « la fenêtre
       s'ouvre pour une contrainte qui ne rompt rien ». */
    await glisser(page, C, -6);
    await expect.poll(async () => (await lire(page, [C])).etat[C], { message: 'C revient sur sa contrainte' })
        .toBe('2026-06-10→2026-06-12 SNET 2026-06-10');
    await expect(fenetre(page), 'aucune fenêtre pour C').toHaveCount(0);

    /* DISCRIMINANT D3 — UN LIEN DÉJÀ ROMPU : X (MSO 11/06, Fin→Début de
       C qui exige le 15) +1 → 12 → 16/06, toujours rompu, et aucune
       fenêtre. Ferme « la fenêtre s'ouvre pour un lien qui était déjà
       rompu ». */
    await glisser(page, X, 1);
    await expect.poll(async () => (await lire(page, [X])).etat[X], { message: 'X suit la souris' })
        .toBe('2026-06-12→2026-06-16 MSO 2026-06-12');
    await expect(fenetre(page), 'aucune fenêtre pour un lien déjà rompu').toHaveCount(0);

    // --- L'ASSERTION CENTRALE ---
    const pile = (await lire(page, [])).pile;
    await glisser(page, B, -10);
    await expect(fenetre(page), 'fenêtre de confirmation absente').toHaveCount(1);
    await expect(fenetre(page)).toBeVisible();
    await expect(page.locator('[aria-modal="true"]:visible'), 'une seule fenêtre modale').toHaveCount(1);
    await expect(fenetre(page), 'la fenêtre est nommée').toHaveAccessibleName('Rompre un lien ?');
    await expect(fenetre(page), 'le message nomme B, A, les dates et l\'écart').toContainText(
        `« ${B} » doit commencer le 05/06/2026, mais son lien Fin→Début avec « ${A} » exige le 08/06/2026 au plus tôt (1 jour ouvré d'écart).`);
    await expect(fenetre(page).getByRole('button', { name: 'Annuler' }), 'le focus est sur « Annuler »').toBeFocused();

    /* Échap : rien n'est écrit. */
    await page.keyboard.press('Escape');
    await expect(fenetre(page), 'la fenêtre quitte le DOM').toHaveCount(0);
    expect((await lire(page, [B])).etat[B], 'Annuler : B garde ses dates et sa contrainte').toBe('2026-06-15→2026-06-17 MSO 2026-06-15');
    expect((await lire(page, [])).pile, 'Annuler : aucun instantané').toBe(pile);
    await expect(page.locator('#conflitsBtn'), 'Annuler : aucun conflit de plus').toHaveAttribute('aria-label', '1 conflit');

    /* Continuer quand même : l'écriture normale, et le toast de conflit. */
    await glisser(page, B, -10);
    await expect(fenetre(page)).toBeVisible();
    await fenetre(page).getByRole('button', { name: 'Continuer quand même' }).click();
    await expect(fenetre(page)).toHaveCount(0);
    await expect.poll(async () => (await lire(page, [B])).etat[B], { message: 'Continuer : B 05 → 09/06, MSO 05/06' })
        .toBe('2026-06-05→2026-06-09 MSO 2026-06-05');
    await expect(page.locator('#conflitsBtn'), 'le lien rompu est un conflit de plus').toHaveAttribute('aria-label', '2 conflits');
    await expect(page.locator('#toastContainer .toast-warning', { hasText: B }), 'le toast nomme B').toBeVisible();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await lire(page, [B])).etat[B], { message: 'Ctrl+Z rend B' })
        .toBe('2026-06-15→2026-06-17 MSO 2026-06-15');
    expect((await lire(page, [W])).etat[W]).toBe(W_ATTENDU);

    await deleteActiveProject(page);
});

test('la fenêtre d\'une « Doit finir le » dit le début qu\'elle tient, pour que l\'écart se lise', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'MFO', [
        ['jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05'],
        ['jeu-b', 'B Fondations', '2026-06-15', '2026-06-17', { ...fs('jeu-a'), constraintType: 'MFO', constraintDate: '2026-06-17' }],
    ]);
    const [W, A, B] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-fenetre-2.json');

    /* DISCRIMINANT — LE MONTAGE NE ROMPT RIEN : B 15 → 17/06, MFO 17/06,
       et pas de bouton de conflits. */
    expect((await lire(page, [W, B])).etat, 'le jeu importé').toEqual({ [W]: W_ATTENDU, [B]: '2026-06-15→2026-06-17 MFO 2026-06-17' });
    await expect(page.locator('#conflitsBtn')).toBeHidden();

    // --- L'ASSERTION CENTRALE ---
    await glisser(page, B, -10);
    await expect(fenetre(page), 'fenêtre de confirmation absente').toHaveCount(1);
    await expect(fenetre(page)).toContainText(
        `« ${B} » doit finir le 05/06/2026, donc commencer le 03/06/2026, mais son lien Fin→Début avec « ${A} » exige un début le 08/06/2026 au plus tôt (3 jours ouvrés d'écart).`);
    await fenetre(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetre(page)).toHaveCount(0);
    expect((await lire(page, [B])).etat[B], 'Annuler : B inchangée').toBe('2026-06-15→2026-06-17 MFO 2026-06-17');

    await deleteActiveProject(page);
});
