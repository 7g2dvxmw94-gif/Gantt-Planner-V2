import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer) et § D4 (redimensionner), sous
 * l'angle des CONTRAINTES DE DATE : glisser une « Doit commencer le » (MSO)
 * ou une « Doit finir le » (MFO) emmène sa date (décision 3 de
 * l'utilisateur : « la contrainte suit la souris »).
 *
 * LE BESOIN. Aujourd'hui, une tâche MSO ou MFO glissée revient à sa date :
 * applyPredecessorConstraints la replace sur sa contrainte, et le geste est
 * perdu sans un mot.
 *
 * LA RÈGLE (plan v4, § 3.3, règles 1 à 4, 7 et 8) :
 *   - le bout VISÉ est le début pour une MSO, la fin pour une MFO ; s'il
 *     n'a pas bougé (redimensionnement de l'autre bout), la contrainte
 *     reste ;
 *   - la nouvelle date est le bord AFFICHÉ du bout visé au lâcher, ramené
 *     au jour ouvré suivant (MSO) ou précédent (MFO) ;
 *   - en déplacement, l'autre bout suit par la durée ouvrée ; en
 *     redimensionnement, il ne bouge pas ; un jalon prend la date ;
 *   - tout part en UN SEUL updateTask : un Ctrl+Z annule le geste ;
 *   - le type ne change jamais.
 *
 * Aucune tâche n'est liée : aucun glisser de ce fichier ne rompt de lien
 * (la fenêtre de confirmation est l'objet d'une PR suivante). Chaque jeu
 * porte un TÉMOIN W, sans contrainte, ven 05 → mar 09/06, jamais glissé.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 4 failed, chacun sur son
 * assertion centrale, la tâche étant revenue à sa date. Les discriminants
 * passent. JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesGlisser ${nomJeu} ${suffixe}`, description: '' },
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

/* DISCRIMINANT D2 — LE TÉMOIN W, jamais glissé, reste au 05 → 09/06. Ferme
   « le glisser ou l'annulation a touché une autre tâche ». */
const W_ATTENDU = '2026-06-05→2026-06-09';

test('glisser une « Doit commencer le » emmène sa date, et un Ctrl+Z l\'annule', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'MSO', [['jeu-r', 'R Réception', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }]]);
    const [W, R] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-glisser-1.json');

    /* DISCRIMINANT D3 — R est à sa contrainte, et son repère le dit. */
    expect((await lire(page, [W, R])).etat, 'le jeu importé').toEqual({ [W]: W_ATTENDU, [R]: '2026-06-15→2026-06-17 MSO 2026-06-15' });
    await expect((await ligneDe(page, R)).locator('.gantt-contrainte')).toHaveAttribute('aria-label', 'Doit commencer le 15/06/2026');

    const avant = await lire(page, []);
    const g = await glisser(page, R, 4);
    expect(Math.round(g.gauche), 'la barre a suivi la souris de 4 colonnes').toBe(4);

    // --- L'ASSERTION CENTRALE ---
    await expect.poll(async () => (await lire(page, [R])).etat[R], { message: 'R : la contrainte suit la souris (19 → 23/06, MSO 19/06)' })
        .toBe('2026-06-19→2026-06-23 MSO 2026-06-19');
    await expect((await ligneDe(page, R)).locator('.gantt-contrainte')).toHaveAttribute('aria-label', 'Doit commencer le 19/06/2026');
    expect((await lire(page, [])).pile, 'un seul instantané pour le geste').toBe(avant.pile + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await lire(page, [W, R])).etat, { message: 'un Ctrl+Z rend R et sa contrainte' })
        .toEqual({ [W]: W_ATTENDU, [R]: '2026-06-15→2026-06-17 MSO 2026-06-15' });

    await deleteActiveProject(page);
});

test('redimensionner : le bout visé emmène la date, l\'autre bout la laisse', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Redim', [
        ['jeu-r1', 'R1 Façade', '2026-06-15', '2026-06-17', { constraintType: 'MFO', constraintDate: '2026-06-17' }],
        ['jeu-r2', 'R2 Toiture', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }],
        ['jeu-r3', 'R3 Menuiseries', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }],
    ]);
    const [W, R1, R2, R3] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-glisser-2.json');
    expect((await lire(page, [W, R1, R2, R3])).etat, 'le jeu importé').toEqual({
        [W]: W_ATTENDU, [R1]: '2026-06-15→2026-06-17 MFO 2026-06-17',
        [R2]: '2026-06-15→2026-06-17 MSO 2026-06-15', [R3]: '2026-06-15→2026-06-17 MSO 2026-06-15',
    });

    /* DISCRIMINANT D4 — LE BOUT NON VISÉ : R3 (MSO) étirée par la droite de
       2 colonnes garde sa contrainte et s'allonge, 15 → 19/06. Ferme « la
       date suit l'autre bout ». */
    await glisser(page, R3, 2, 'droite');
    await expect.poll(async () => (await lire(page, [R3])).etat[R3], { message: 'R3 : bout non visé, contrainte inchangée' })
        .toBe('2026-06-15→2026-06-19 MSO 2026-06-15');

    // --- L'ASSERTION CENTRALE ---
    /* R1 (MFO 17/06) : bord droit +4, lâché le dimanche 21 → vendredi 19. */
    await glisser(page, R1, 4, 'droite');
    await expect.poll(async () => (await lire(page, [R1])).etat[R1], { message: 'R1 : 15 → 19/06, « Doit finir le 19/06 »' })
        .toBe('2026-06-15→2026-06-19 MFO 2026-06-19');
    /* R2 (MSO 15/06) : bord gauche −3, lâché le vendredi 12. */
    await glisser(page, R2, -3, 'gauche');
    await expect.poll(async () => (await lire(page, [R2])).etat[R2], { message: 'R2 : 12 → 17/06, « Doit commencer le 12/06 »' })
        .toBe('2026-06-12→2026-06-17 MSO 2026-06-12');
    expect((await lire(page, [W])).etat[W]).toBe(W_ATTENDU);

    await deleteActiveProject(page);
});

test('un jalon contraint glissé prend la date ouvrée la plus proche du côté de sa contrainte', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Jalons', [
        ['jeu-j1', 'J1 Réception', '2026-06-12', '2026-06-12', { isMilestone: true, constraintType: 'MSO', constraintDate: '2026-06-12' }],
        ['jeu-j2', 'J2 Livraison', '2026-06-12', '2026-06-12', { isMilestone: true, constraintType: 'MFO', constraintDate: '2026-06-12' }],
    ]);
    const [W, J1, J2] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-glisser-3.json');
    expect((await lire(page, [W, J1, J2])).etat, 'le jeu importé').toEqual({
        [W]: W_ATTENDU, [J1]: '2026-06-12→2026-06-12 MSO 2026-06-12', [J2]: '2026-06-12→2026-06-12 MFO 2026-06-12',
    });

    /* DISCRIMINANT D5 — J2 (MFO 12/06) lâché le samedi 13 reste au vendredi
       12. Ferme « un jalon reste sur un samedi ». */
    await glisser(page, J2, 1);
    await expect.poll(async () => (await lire(page, [J2])).etat[J2], { message: 'J2 : reste au vendredi 12' })
        .toBe('2026-06-12→2026-06-12 MFO 2026-06-12');

    // --- L'ASSERTION CENTRALE ---
    /* J1 (MSO 12/06) lâché le dimanche 14 → lundi 15. */
    await glisser(page, J1, 2);
    await expect.poll(async () => (await lire(page, [J1])).etat[J1], { message: 'J1 : 15/06, « Doit commencer le 15/06 »' })
        .toBe('2026-06-15→2026-06-15 MSO 2026-06-15');
    expect((await lire(page, [W])).etat[W]).toBe(W_ATTENDU);

    await deleteActiveProject(page);
});

test('une « Doit finir le » déplacée par-dessus un week-end prend le vendredi de son bord droit', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'MFO', [['jeu-r', 'R Clôture', '2026-06-10', '2026-06-12', { constraintType: 'MFO', constraintDate: '2026-06-12' }]]);
    const [W, R] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-glisser-4.json');
    expect((await lire(page, [W, R])).etat, 'le jeu importé').toEqual({ [W]: W_ATTENDU, [R]: '2026-06-10→2026-06-12 MFO 2026-06-12' });

    /* DISCRIMINANT D6 — AVANT LE LÂCHER, la barre a suivi la souris de 8
       colonnes : son bord droit est au bout du samedi 20. Ferme « on n'a
       pas lâché le bord droit un samedi ». */
    const g = await glisser(page, R, 8);
    expect(Math.round(g.gauche), 'bord gauche : 8 colonnes').toBe(8);
    expect(Math.round(g.droite), 'bord droit : 8 colonnes, au bout du samedi 20').toBe(8);

    // --- L'ASSERTION CENTRALE ---
    await expect.poll(async () => (await lire(page, [R])).etat[R], { message: 'R : 17 → 19/06, « Doit finir le 19/06 »' })
        .toBe('2026-06-17→2026-06-19 MFO 2026-06-19');
    expect((await lire(page, [W])).etat[W]).toBe(W_ATTENDU);

    await deleteActiveProject(page);
});
