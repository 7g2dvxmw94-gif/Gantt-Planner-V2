import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer) et § D4 (redimensionner), sous
 * l'angle des DATES RÉELLES : le début d'une tâche commencée est un fait,
 * la fin d'une tâche finie aussi ; la souris ne doit pas faire mine de les
 * déplacer.
 *
 * LE DÉFAUT, mesuré par une sonde sur la base du moteur ancré (R2) : tirer
 * le bord GAUCHE d'une tâche commencée (lundi 08 → mercredi 10/06, Début
 * réel le 08) de deux jours la laisse au 08 → 08. Le glisser écrit le
 * début au 10, garde la fin au 10 — un jour — puis le moteur la ramène à
 * son Début réel, durée tirée comprise : la tâche a perdu deux jours sans
 * que personne ne touche à sa fin. Forme « deux implémentations d'une même
 * règle qui divergent » : le moteur ancre le début, le glisser l'ignore.
 * Par ailleurs, déplacer une tâche commencée, ou tirer la fin d'une tâche
 * finie, fait suivre la barre puis la ramène, en laissant un instantané
 * d'annulation qui n'annule rien.
 *
 * LA RÈGLE (plan des dates réelles) : une tâche commencée ne se déplace
 * plus et son bord gauche ne se tire plus ; seule sa fin se tire, tant
 * qu'elle n'est pas finie. Figée, la barre ne suit pas la souris et le
 * lâcher n'écrit rien, sans instantané.
 *
 * LE JEU, importé, sans lien, au zoom « jour » :
 *   W  08 → 10/06, non commencée (le témoin : le glisser marche) ;
 *   S1 08 → 10/06, commencée le 08 (déplacée) ;
 *   S2 08 → 10/06, commencée le 08 (fin tirée : permis) ;
 *   S3 08 → 10/06, commencée le 08 (bord gauche tiré) ;
 *   S4 08 → 10/06, commencée le 08, finie le 10 (fin tirée).
 * Chaque glisser est de deux colonnes vers la droite. JUIN 2026 COMMENCE
 * UN LUNDI et n'a aucun férié.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur la première
 * assertion centrale : S3 relue 08 → 08 au lieu de 08 → 10. Les
 * discriminants — W déplacée au 10 → 12, S2 étirée au 08 → 12 — passent. */

function jeu(suffixe) {
    const tache = ([cle, extra = {}], ordre) => ({
        id: `jeu-${cle}`, name: `${cle} Figee ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const commencee = { actualStart: '2026-06-08', progress: 30, status: 'in_progress' };
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesGlisser ${suffixe}`, description: '' },
        tasks: [
            ['W'], ['S1', commencee], ['S2', commencee], ['S3', commencee],
            ['S4', { actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }],
        ].map(tache),
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** L'identifiant d'une tâche, lu dans le store par son nom. */
async function idDe(page, nom) {
    const ids = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getTasks().filter(t => t.name === nom).map(t => t.id);
    }, nom);
    expect(ids, `une seule tâche « ${nom} »`).toHaveLength(1);
    return ids[0];
}
const barreDe = async (page, nom) => page.locator(`.gantt-timeline-cell [data-task-id="${await idDe(page, nom)}"]`);

/** Dates des tâches nommées et profondeur de la pile d'annulation, lues
 *  dans le store VIVANT. */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            pile: store._undoStack ? store._undoStack.length : null,
            etat: Object.fromEntries(noms.map(n => {
                const t = taches.filter(x => x.name === n);
                return [n, t.length === 1 ? `${t[0].startDate}→${t[0].endDate}` : `${t.length} tâche(s)`];
            })),
        };
    }, noms);
}

const largeurColonne = async (page) => (await present(page.locator('.gantt-timeline-grid-col').first(),
    'colonne de la grille du Gantt')).evaluate(el => el.getBoundingClientRect().width);

/** Glisse la barre (ou une poignée) de `colonnes` colonnes ; rend de
 *  combien de colonnes ses bords ont suivi la souris AVANT le lâcher. */
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
    return `gauche ${Math.round((pendant.g - avant.g) / largeur)}, droite ${Math.round((pendant.d - avant.d) / largeur)}`;
}

test('une tâche commencée ne se déplace plus à la souris ; seule sa fin se tire, tant qu\'elle n\'est pas finie', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const [W, S1, S2, S3, S4] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dates-reelles-glisser.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE GANTT, AU ZOOM « JOUR » (relu des réglages du
       compte partagé). Ferme « une colonne n'est pas un jour ». */
    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour, 'le zoom « jour » n\'est pas actif').toHaveClass(/active/);

    /* DISCRIMINANT — LE GLISSER MARCHE : W, non commencée, déplacée de deux
       colonnes, passe au 10 → 12. Ferme « rien ne bouge parce que le geste
       n'atteint pas la barre ». Passe avant comme après. */
    expect(await glisser(page, W, 2), 'W suit la souris').toBe('gauche 2, droite 2');
    await expect.poll(async () => (await lire(page, [W])).etat[W], { message: 'W déplacée' }).toBe('2026-06-10→2026-06-12');

    /* DISCRIMINANT — LA FIN D'UNE TÂCHE COMMENCÉE MAIS NON FINIE SE TIRE :
       S2 passe au 08 → 12. Ferme « le correctif fige tout » : la règle
       laisse cette poignée. Passe avant comme après. */
    expect(await glisser(page, S2, 2, 'droite'), 'la fin de S2 suit la souris').toBe('gauche 0, droite 2');
    await expect.poll(async () => (await lire(page, [S2])).etat[S2], { message: 'S2 étirée' }).toBe('2026-06-08→2026-06-12');

    // --- L'ASSERTION CENTRALE ---
    /* S3, bord gauche tiré : la tâche ne perd aucun jour. */
    const pileAvant = (await lire(page, [])).pile;
    const pendantS3 = await glisser(page, S3, 2, 'gauche');
    await page.waitForTimeout(300);
    expect((await lire(page, [S3])).etat[S3], 'S3, bord gauche tiré, garde ses trois jours').toBe('2026-06-08→2026-06-10');
    expect(pendantS3, 'le bord gauche de S3 ne suit pas la souris').toBe('gauche 0, droite 0');

    /* S1 déplacée, S4 finie étirée : la barre ne suit pas, rien n'est
       écrit, aucun instantané. */
    expect(await glisser(page, S1, 2), 'S1 ne suit pas la souris').toBe('gauche 0, droite 0');
    expect(await glisser(page, S4, 2, 'droite'), 'la fin de S4, finie, ne suit pas la souris').toBe('gauche 0, droite 0');
    await page.waitForTimeout(300);
    const apres = await lire(page, [S1, S3, S4]);
    expect(apres.etat, 'S1, S3, S4 à leurs dates').toEqual({
        [S1]: '2026-06-08→2026-06-10', [S3]: '2026-06-08→2026-06-10', [S4]: '2026-06-08→2026-06-10',
    });
    expect(apres.pile, 'aucun instantané pour des gestes qui n\'écrivent rien').toBe(pileAvant);

    await deleteActiveProject(page);
});
