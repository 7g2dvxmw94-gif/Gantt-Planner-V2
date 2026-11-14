import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § C1 (rendu du Gantt) et § D4 (infobulle), sous
 * l'angle des CONTRAINTES DE DATE : le Gantt montre la date de contrainte.
 *
 * LE BESOIN. Depuis #115 le moteur place une tâche selon sa contrainte, et
 * depuis #119 la fiche permet d'en poser une. Mais le Gantt ne montre
 * rien : une « Début au plus tôt le 03/06 » qui ne lie pas (la tâche est
 * tenue plus tard par son prédécesseur) est invisible, et une « Doit finir
 * le 19/06 » ressemble à n'importe quelle barre.
 *
 * LE JEU, importé par le bouton « Importer » :
 *   A  lundi 01 → vendredi 05/06/2026, sans contrainte ;
 *   B  Fin→Début de A, « Début au plus tôt le » 03/06 (SNET) : la
 *      contrainte ne lie pas, le lien place B 08 → 10/06 ;
 *   C  racine, « Doit finir le » 19/06 (MFO), posée 17 → 19/06 ;
 *   D  racine, « Dès que possible », posée 08 → 10/06.
 *
 * L'ATTENDU. Sur la ligne de B, un repère nommé « Début au plus tôt le
 * 03/06/2026 », au bord GAUCHE du 03/06 : 5 colonnes (03, 04, 05, 06, 07)
 * à gauche de la barre. Sur la ligne de C, un repère au bord DROIT du
 * 19/06, c'est-à-dire au bord droit de la barre. Rien sur la ligne de D.
 * Au survol de la barre de B, l'infobulle porte la ligne « Début au plus
 * tôt le 03/06/2026 ».
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « repère de contrainte absent de la ligne de B ». Les
 * discriminants passent. JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesRepere ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-08', '2026-06-10', 1, {
                dependencies: [{ taskId: 'jeu-a', type: 'FS', lag: 0 }],
                constraintType: 'SNET', constraintDate: '2026-06-03',
            }),
            tache('jeu-c', 'C Réception', '2026-06-17', '2026-06-19', 2, {
                constraintType: 'MFO', constraintDate: '2026-06-19',
            }),
            tache('jeu-d', 'D Réseaux', '2026-06-08', '2026-06-10', 3),
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

async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: Object.fromEntries(noms.map(n => {
                const t = taches.filter(x => x.name === n);
                return [n, t.length === 1 ? `${t[0].startDate}→${t[0].endDate}` : `${t.length} tâche(s)`];
            })),
        };
    }, noms);
}

/** Abscisse du centre d'un élément, en pixels d'écran. */
const centre = (r) => r.x + r.width / 2;

test('le Gantt montre la date de contrainte : repère à sa date, nommé, et ligne dans l\'infobulle', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, C, D] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'contraintes-repere.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT D1 — LE GANTT, AU ZOOM « JOUR ». Le zoom est relu des
       réglages du compte partagé : il est posé puis relu. Ferme « une
       colonne n'est pas un jour » : au zoom mois, 5 jours ne font pas 5
       colonnes et l'écart mesuré ne dirait rien. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT D2 — LES BARRES SONT OÙ ON LE CROIT. B relue 08 → 10/06
       et C 17 → 19/06 dans le store, et leurs barres sont visibles. Ferme
       « le repère est mesuré à côté d'une barre mal placée » : l'écart
       attendu suppose ces dates. */
    const lu = await lire(page, [A, B, C, D]);
    expect(lu.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [A]: '2026-06-01→2026-06-05', [B]: '2026-06-08→2026-06-10',
        [C]: '2026-06-17→2026-06-19', [D]: '2026-06-08→2026-06-10',
    });
    const barreB = await present(barreDe(page, B), `barre de « ${B} »`);
    const barreC = await present(barreDe(page, C), `barre de « ${C} »`);
    await present(barreDe(page, D), `barre de « ${D} »`);
    await barreB.scrollIntoViewIfNeeded();
    await expect(barreB).toBeVisible();

    /* DISCRIMINANT D3 — LA LARGEUR D'UNE COLONNE EST LUE DANS LE DOM, pas
       supposée (elle s'élargit pour remplir l'écran). Elle est confirmée
       par la barre de B, qui couvre 3 jours : 08, 09, 10. Ferme « l'écart
       en pixels est supposé ». */
    const ligneB = await present(ligneDe(page, B), `ligne de « ${B} »`);
    const col = await ligneB.locator('.gantt-timeline-grid-col').first().evaluate(e => e.getBoundingClientRect().width);
    const rB = await barreB.boundingBox();
    expect(Math.abs(rB.width - 3 * col), `la barre de B ne fait pas 3 colonnes (colonne ${col} px, barre ${rB.width} px)`)
        .toBeLessThan(1.5);

    // --- L'ASSERTION CENTRALE ---
    const repereB = ligneB.locator('.gantt-contrainte');
    await expect(repereB, 'repère de contrainte absent de la ligne de B').toHaveCount(1);
    await expect(repereB, 'le repère de B doit être nommé par son type et sa date')
        .toHaveAttribute('aria-label', 'Début au plus tôt le 03/06/2026');
    const rRepB = await repereB.boundingBox();
    expect(Math.abs(centre(rRepB) - (rB.x - 5 * col)),
        `le repère de B doit être au bord gauche du 03/06, 5 colonnes avant la barre (repère ${centre(rRepB)}, barre ${rB.x}, colonne ${col})`)
        .toBeLessThan(2);

    const ligneC = await present(ligneDe(page, C), `ligne de « ${C} »`);
    const repereC = ligneC.locator('.gantt-contrainte');
    await expect(repereC, 'repère de contrainte absent de la ligne de C').toHaveCount(1);
    await expect(repereC).toHaveAttribute('aria-label', 'Doit finir le 19/06/2026');
    const rC = await barreC.boundingBox();
    const rRepC = await repereC.boundingBox();
    expect(Math.abs(centre(rRepC) - (rC.x + rC.width)),
        `le repère de C doit être au bord droit du 19/06, au bord droit de la barre (repère ${centre(rRepC)}, fin de barre ${rC.x + rC.width})`)
        .toBeLessThan(2);

    await expect(ligneDe(page, D).locator('.gantt-contrainte'),
        'une tâche « Dès que possible » ne porte pas de repère').toHaveCount(0);

    await barreB.hover();
    const bulle = page.locator('.gantt-hover-tooltip');
    await expect(bulle, 'l\'infobulle de B doit s\'ouvrir au survol').toBeVisible();
    await expect(bulle, 'l\'infobulle est celle de B').toContainText(B);
    await expect(bulle, 'l\'infobulle de B doit porter sa contrainte').toContainText('Début au plus tôt le 03/06/2026');
    await page.mouse.move(0, 0);

    await deleteActiveProject(page);
});
