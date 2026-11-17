import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B12, étape 14 : le Gantt montre qu'une tâche est
 * COMMENCÉE, et ses dates réelles.
 *
 * LE BESOIN. Depuis R1 à R6, le Début réel et la Fin réelle se saisissent,
 * ancrent le moteur, s'affichent au Tableau et passent par les imports et
 * exports. Mais sur le Gantt, rien ne distingue une tâche commencée d'une
 * tâche qui ne l'est pas : ni la barre, ni son nom accessible, ni
 * l'infobulle. Celui qui pilote le planning depuis le Gantt ne voit pas
 * ce qui est un fait et ce qui est une prévision.
 *
 * LA RÈGLE (plan des dates réelles, R4b) : la barre d'une tâche commencée
 * porte la classe « commencee » (et « finie » si elle a une Fin réelle) ;
 * son nom accessible dit « commencée le … » (et « finie le … ») ; son
 * infobulle porte une ligne « Réel : début → fin », la fin valant « — »
 * tant qu'elle n'est pas finie. Les dates viennent de la règle unique
 * datesReellesDe : une Fin réelle seule prend le début prévu.
 *
 * LE JEU, importé, sans lien :
 *   W  08 → 10/06, non commencée (le témoin) ;
 *   S  08 → 10/06, commencée le 08 ;
 *   F  08 → 10/06, commencée le 08, finie le 10 ;
 *   E  15 → 17/06, Fin réelle 17 SEULE : réel 15 → 17 par la règle unique.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion centrale
 * « la barre de S ne dit pas qu'elle est commencée ». Les discriminants —
 * les quatre barres présentes, l'infobulle de W qui s'ouvre avec ses dates
 * prévues et sans ligne du réel — passent. */

function jeu(suffixe) {
    const tache = ([cle, startDate, endDate, extra = {}], ordre) => ({
        id: `jeu-${cle}`, name: `${cle} Gantt ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesGantt ${suffixe}`, description: '' },
        tasks: [
            ['W', '2026-06-08', '2026-06-10'],
            ['S', '2026-06-08', '2026-06-10', { actualStart: '2026-06-08', progress: 30, status: 'in_progress' }],
            ['F', '2026-06-08', '2026-06-10', { actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }],
            ['E', '2026-06-15', '2026-06-17', { actualFinish: '2026-06-17', progress: 100, status: 'done' }],
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
const barreDe = async (page, nom) => page.locator(`.gantt-timeline-cell .gantt-bar[data-task-id="${await idDe(page, nom)}"]`);

/** Les dates telles que l'application les affiche, calculées par SON
 *  formateur : ferme « l'attendu suppose une locale ». */
async function affichees(page, isos) {
    return page.evaluate(async (isos) => {
        const { formatDateDisplay } = await import(new URL('js/utils.js', document.baseURI).href);
        return Object.fromEntries(isos.map(d => [d, formatDateDisplay(d)]));
    }, isos);
}

/** Survole la barre et rend le texte de l'infobulle et celui de sa ligne
 *  du réel ('' si absente). La souris quitte d'abord le Gantt : l'infobulle
 *  précédente se ferme. */
async function infobulle(page, nom) {
    const barre = await present(await barreDe(page, nom), `barre de « ${nom} »`);
    await barre.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(page.locator('.gantt-hover-tooltip'), 'l\'infobulle précédente doit se fermer').toHaveCount(0);
    await barre.hover();
    const bulle = page.locator('.gantt-hover-tooltip');
    await expect(bulle, `l'infobulle de « ${nom} » doit s'ouvrir`).toBeVisible();
    await expect(bulle.locator('.gtt-title'), 'l\'infobulle est celle de la barre survolée').toHaveText(nom);
    const reel = bulle.locator('.gtt-reel');
    return { texte: await bulle.innerText(), reel: (await reel.count()) ? await reel.innerText() : '' };
}

test('le Gantt montre qu\'une tâche est commencée : barre, nom accessible, infobulle', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const [W, S, F, E] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dates-reelles-gantt.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');

    const d = await affichees(page, ['2026-06-08', '2026-06-10', '2026-06-15', '2026-06-17']);

    /* DISCRIMINANT — LES QUATRE BARRES SONT LÀ. Ferme « le sélecteur ne
       résout pas » : une barre absente ferait échouer chaque assertion
       suivante pour une raison étrangère au réel. Passe avant comme après. */
    for (const nom of [W, S, F, E]) await present(await barreDe(page, nom), `barre de « ${nom} »`);

    /* DISCRIMINANT — L'INFOBULLE DE W S'OUVRE, avec ses dates prévues, et
       SANS ligne du réel ; sa barre n'a aucune marque. Ferme « l'infobulle
       ne s'ouvre pas au survol » et « la marque est posée sur toute barre ».
       Passe avant comme après. */
    const bulleW = await infobulle(page, W);
    expect(bulleW.texte, 'les dates prévues de W dans son infobulle').toContain(`${d['2026-06-08']} → ${d['2026-06-10']}`);
    expect(bulleW.reel, 'W, non commencée, n\'a pas de ligne du réel').toBe('');
    const barreW = await barreDe(page, W);
    await expect(barreW, 'W, non commencée, ne porte pas la marque').not.toHaveClass(/\bcommencee\b/);
    expect(await barreW.getAttribute('aria-label'), 'le nom accessible de W ne dit pas « commencée »').not.toMatch(/commenc/i);

    // --- L'ASSERTION CENTRALE ---
    /* La barre de S dit qu'elle est commencée, à la vue et au lecteur
       d'écran ; son infobulle porte le réel, fin à « — ». */
    const barreS = await barreDe(page, S);
    await expect(barreS, 'la barre de S ne dit pas qu\'elle est commencée').toHaveClass(/\bcommencee\b/);
    await expect(barreS, 'S, non finie, ne porte pas la marque « finie »').not.toHaveClass(/\bfinie\b/);
    expect(await barreS.getAttribute('aria-label'), 'le nom accessible de S').toContain(`commencée le ${d['2026-06-08']}`);
    expect((await infobulle(page, S)).reel, 'la ligne du réel de S').toContain(`${d['2026-06-08']} → —`);

    /* F, finie : les deux marques, les deux dates. */
    const barreF = await barreDe(page, F);
    await expect(barreF, 'F porte la marque « commencée »').toHaveClass(/\bcommencee\b/);
    await expect(barreF, 'F porte la marque « finie »').toHaveClass(/\bfinie\b/);
    expect(await barreF.getAttribute('aria-label'), 'le nom accessible de F').toContain(`finie le ${d['2026-06-10']}`);
    expect((await infobulle(page, F)).reel, 'la ligne du réel de F').toContain(`${d['2026-06-08']} → ${d['2026-06-10']}`);

    /* E, Fin réelle seule : la règle unique lui donne le début prévu. Ferme
       « l'affichage lit les champs bruts » : actualStart y est vide. */
    const barreE = await barreDe(page, E);
    await expect(barreE, 'E, finie, porte la marque « commencée »').toHaveClass(/\bcommencee\b/);
    expect((await infobulle(page, E)).reel, 'la ligne du réel de E').toContain(`${d['2026-06-15']} → ${d['2026-06-17']}`);

    await page.mouse.move(0, 0);
    await deleteActiveProject(page);
});
