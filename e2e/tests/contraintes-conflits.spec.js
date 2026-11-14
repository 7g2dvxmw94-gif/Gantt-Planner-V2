import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (contraintes de date) : un lien rompu par une
 * contrainte est signalé.
 *
 * LE BESOIN. La contrainte l'emporte sur les liens (décision de
 * l'utilisateur, comme MS Project). Une « Doit commencer le » posée avant
 * la fin de son prédécesseur rompt donc le lien, en silence : rien ne le
 * dit, ni dans le Gantt ni ailleurs. Sur un planning de 1 000 lignes, la
 * tâche est souvent hors de l'écran.
 *
 * LE JEU, importé par le bouton « Importer » :
 *   A  lundi 01 → vendredi 05/06/2026 ;
 *   B  Fin→Début de A, « Doit commencer le » 04/06 (MSO) : la contrainte
 *      l'emporte, B est placée 04 → 08/06 et le lien A→B est rompu (A
 *      exige le 08, B tient le 04 : 2 jours ouvrés plus tôt, le 04 et
 *      le 05) ;
 *   C  TÉMOIN, 01 → 05/06 ;
 *   D  TÉMOIN, Fin→Début de C, « Doit commencer le » 10/06 : contrainte
 *      dure elle aussi, mais le lien est tenu (C exige le 08, D tient
 *      le 10) ;
 *   E  TÉMOIN, Fin→Début de C, « Début au plus tôt le » 02/06 (SNET),
 *      importée 02 → 04/06 : son lien n'est pas tenu, mais une contrainte
 *      SOUPLE ne l'emporte jamais sur un lien. Ce n'est pas un conflit de
 *      contrainte (des données anciennes ; le DCMA le compte en marge
 *      négative).
 *
 * L'ATTENDU. Un bouton « ⚠ 1 conflit » dans la barre d'outils ouvre une
 * liste qui nomme B, A, le type de lien, la date exigée, la date tenue et
 * l'écart, et dit que le calcul suit le calendrier de l'utilisateur. Le
 * lien A→B est tracé en conflit, le repère de B aussi. « Ouvrir la fiche »
 * ferme la liste et ouvre la fiche de B. Quand A finit plus tôt, le
 * conflit et le bouton disparaissent.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « bouton des conflits absent ». Les discriminants passent.
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
        project: { id: 'jeu-projet', name: `E2E ContraintesConflits ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-04', '2026-06-08', 1, {
                dependencies: fs('jeu-a'), constraintType: 'MSO', constraintDate: '2026-06-04',
            }),
            tache('jeu-c', 'C Réseaux', '2026-06-01', '2026-06-05', 2),
            tache('jeu-d', 'D Voirie', '2026-06-10', '2026-06-12', 3, {
                dependencies: fs('jeu-c'), constraintType: 'MSO', constraintDate: '2026-06-10',
            }),
            tache('jeu-e', 'E Clôture', '2026-06-02', '2026-06-04', 4, {
                dependencies: fs('jeu-c'), constraintType: 'SNET', constraintDate: '2026-06-02',
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

test('un lien rompu par une contrainte est signalé : bouton, liste, lien et repère, ouverture de la fiche', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, C, D, E] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'contraintes-conflits.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE GANTT, AU ZOOM « JOUR » (relu des réglages du
       compte partagé : posé puis relu). Ferme « les barres et les liens ne
       sont pas rendus » : la classe des liens serait lue sur rien. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT D1 — B TIENT SA CONTRAINTE, CONTRE SON LIEN. B est relue
       04 → 08/06. Ferme « il n'y a pas de conflit parce que B a suivi A » :
       une B placée au 08 ne romprait rien. */
    /* DISCRIMINANT D2 — LE TÉMOIN D, CONTRAINTE DURE AU LIEN TENU, est relu
       10 → 12/06. Ferme « tout lien vers une tâche à contrainte dure serait
       déclaré rompu » : l'assertion centrale exige ensuite qu'elle ne soit
       pas listée et que son lien ne soit pas tracé en conflit. */
    /* DISCRIMINANT D3 — LE TÉMOIN E EST RESTÉ 02 → 04/06, lien non tenu.
       Ferme « E n'est pas listée parce que l'import l'a replacée » : il
       faut que son lien soit vraiment non tenu pour que son absence de la
       liste dise que seule une contrainte DURE fait un conflit. */
    const lu = await lire(page, [A, B, C, D, E]);
    expect(lu.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [A]: '2026-06-01→2026-06-05', [B]: '2026-06-04→2026-06-08',
        [C]: '2026-06-01→2026-06-05', [D]: '2026-06-10→2026-06-12',
        [E]: '2026-06-02→2026-06-04',
    });
    for (const n of [A, B, C, D, E]) await present(barreDe(page, n), `barre de « ${n} »`);

    // --- L'ASSERTION CENTRALE ---
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'bouton des conflits absent').toBeVisible();
    await expect(conflitsBtn, 'le bouton doit compter 1 conflit').toHaveAttribute('aria-label', '1 conflit');

    /* Le lien A→B est tracé en conflit, celui de C→D non ; le repère de B
       est en conflit, celui de D non. */
    const lien = (de, vers) => page.locator(`path.dep-line[data-pred="${lu.ids[de]}"][data-succ="${lu.ids[vers]}"]`);
    await expect(lien(A, B), 'le lien A→B doit être tracé en conflit').toHaveClass(/dep-conflit/);
    await expect(lien(C, D), 'le lien C→D, tenu, est tracé').toHaveCount(1);
    await expect(lien(C, D), 'le lien C→D est tenu : pas de conflit').not.toHaveClass(/dep-conflit/);
    await expect(lien(C, E), 'le lien C→E est tracé').toHaveCount(1);
    await expect(lien(C, E), 'E a une contrainte souple : son lien n\'est pas un conflit de contrainte').not.toHaveClass(/dep-conflit/);
    await expect(ligneDe(page, B).locator('.gantt-contrainte'), 'le repère de B doit être en conflit').toHaveClass(/en-conflit/);
    await expect(ligneDe(page, D).locator('.gantt-contrainte'), 'le repère de D n\'est pas en conflit').not.toHaveClass(/en-conflit/);

    await conflitsBtn.click();
    const liste = page.locator('#conflitsModal [role="dialog"]');
    await expect(liste, 'la liste des conflits doit s\'ouvrir').toBeVisible();
    await expect(liste).toHaveAttribute('aria-modal', 'true');
    const lignes = liste.locator('.conflit-ligne');
    await expect(lignes, 'une seule ligne : celle de B, ni D ni E').toHaveCount(1);
    const ligne = lignes.first();
    for (const attendu of [B, A, 'Fin→Début', 'Doit commencer le 04/06/2026', '08/06/2026', '04/06/2026', '2 jours ouvrés']) {
        await expect(ligne, `la ligne du conflit doit dire « ${attendu} »`).toContainText(attendu);
    }
    await expect(liste, 'la liste doit dire que le calcul suit le calendrier de l\'utilisateur')
        .toContainText('Calculé avec votre calendrier');

    /* « Ouvrir la fiche » : la liste quitte le DOM, et la seule fenêtre
       modale visible est la fiche de B. */
    await ligne.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await expect(page.locator('#conflitsModal'), 'la liste doit quitter le DOM').toHaveCount(0);
    const modales = page.locator('[aria-modal="true"]:visible');
    await expect(modales, 'une seule fenêtre modale visible').toHaveCount(1);
    await expect(page.locator('#taskModalOverlay'), 'la fiche doit s\'ouvrir').toBeVisible();
    await expect(page.locator('#taskName'), 'la fiche ouverte est celle de B').toHaveValue(B);
    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay'), 'la fiche de B doit se fermer').toBeHidden();

    /* A finit le 03 : B tient sa contrainte ET son lien, le conflit et le
       bouton disparaissent. */
    await (await present(barreDe(page, A), `barre de « ${A} »`)).dblclick();
    await expect(page.locator('#taskName'), 'la fiche ouverte est celle de A').toHaveValue(A);
    await (await present(page.locator('#taskEnd'), 'champ de fin')).fill('2026-06-03');
    await (await present(page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(page.locator('#taskModalOverlay'), 'la fiche de A doit se fermer').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [A])).dates[A], 'A doit finir le 03').toBe('2026-06-01→2026-06-03');
    await expect(conflitsBtn, 'sans conflit, le bouton disparaît').toBeHidden();
    await expect(lien(A, B), 'le lien A→B n\'est plus en conflit').not.toHaveClass(/dep-conflit/);

    await deleteActiveProject(page);
});
