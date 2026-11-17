import { test, expect } from '../fixtures.js';
import { waitForAppReady, deleteActiveProject } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B12, étape 5 : une tâche COMMENCÉE est ancrée sur
 * ses dates réelles, comme dans MS Project.
 *
 * LE BESOIN. Depuis R1 (#158), la fiche pose un Début réel et une Fin
 * réelle, et le prévu les suit. Mais le moteur (_computeConstrainedDates,
 * store.js, point unique de vérité du placement) les ignore : qu'un
 * prédécesseur glisse, et une tâche commencée le 08/06 est replacée au
 * 15/06, son Début réel restant au 08. Le planning dit alors qu'elle n'a
 * pas commencé à la date où elle a commencé.
 *
 * LA RÈGLE (plan des dates réelles) : une tâche qui a un Début réel n'est
 * déplacée ni par ses liens ni par sa contrainte ; sa fin est la Fin
 * réelle, sinon Début réel + durée ouvrée. Ses successeurs se placent
 * d'après elle.
 *
 * LE JEU, importé (l'import ne place rien : les dates arrivent telles
 * quelles), tous les liens Fin→Début sans décalage :
 *   A  01 → 05/06/2026, non commencée, prédécesseur de B, D, E, G ;
 *   B  08 → 10/06, COMMENCÉE le 08 ; C la suit, 11 → 12/06 ;
 *   D  08 → 09/06, non commencée (le témoin) ;
 *   E  08 → 09/06 prévue, commencée le 08 et FINIE LE 10 (plus tard que
 *      prévu) ; F la suit, 10 → 11/06, placée d'après la fin prévue ;
 *   G  10 → 12/06 prévue (3 jours ouvrés), mais COMMENCÉE LE 08 : son
 *      ancrage la ramène au 08, durée ouvrée conservée (08 → 10).
 * L'action : la fin de A passe au vendredi 12/06, par sa fiche.
 * JUIN 2026 COMMENCE UN LUNDI et n'a aucun férié.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : B relue 15 → 17/06 (C 18 → 19, E 15 → 16, F 17 → 18, G
 * 15 → 17) au lieu de B 08 → 10, C 11 → 12, E 08 → 10, F 11 → 12, G
 * 08 → 10. Les discriminants — le
 * socle importé, A replacée, D poussée au 15 → 16 — passent. */

const FICHE = '#taskModalOverlay';
const fiche = (page) => page.locator(FICHE);
const CLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function jeu(suffixe) {
    const tache = (cle, startDate, endDate, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} Ancre ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const apres = (cle) => [{ taskId: `jeu-${cle}`, type: 'FS', lag: 0 }];
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesMoteur ${suffixe}`, description: '' },
        tasks: [
            tache('A', '2026-06-01', '2026-06-05', 0),
            tache('B', '2026-06-08', '2026-06-10', 1, { dependencies: apres('A'), actualStart: '2026-06-08', progress: 30, status: 'in_progress' }),
            tache('C', '2026-06-11', '2026-06-12', 2, { dependencies: apres('B') }),
            tache('D', '2026-06-08', '2026-06-09', 3, { dependencies: apres('A') }),
            tache('E', '2026-06-08', '2026-06-09', 4, { dependencies: apres('A'), actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }),
            tache('F', '2026-06-10', '2026-06-11', 5, { dependencies: apres('E') }),
            tache('G', '2026-06-10', '2026-06-12', 6, { dependencies: apres('A'), actualStart: '2026-06-08', progress: 10, status: 'in_progress' }),
        ],
        resources: [],
    };
}

/* Ce que les attendus supposent du calendrier : lundi-vendredi, aucun férié
   du 01 au 19 juin. */
const CALENDRIER_SUPPOSE = {
    '2026-06-05': true, '2026-06-06': false, '2026-06-07': false, '2026-06-08': true,
    '2026-06-10': true, '2026-06-12': true, '2026-06-13': false, '2026-06-14': false,
    '2026-06-15': true, '2026-06-17': true, '2026-06-19': true,
};

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** « clé:début→fin » pour chaque clé, lu dans le store VIVANT, par nom. */
async function lire(page, s, cles) {
    return page.evaluate(async ({ s, cles }) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: cles.map(c => {
                const t = taches.filter(x => x.name === `${c} Ancre ${s}`);
                return t.length === 1 ? `${c}:${t[0].startDate}→${t[0].endDate}` : `${c}:${t.length} tâche(s)`;
            }).join(' '),
        };
    }, { s: String(s), cles });
}

test('une tâche commencée reste sur ses dates réelles quand son prédécesseur glisse, et ses successeurs la suivent', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const nomProjet = donnees.project.name;

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dates-reelles-moteur.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, s, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — ON REGARDE LE GANTT : la fiche s'ouvre par le nom,
       dans sa colonne de gauche. La vue est héritée du compte partagé. */
    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT — LE CALENDRIER EST CELUI QU'ON CROIT. Ferme « un férié
       posé par un autre test du compte partagé déplace D ». */
    const cal = await page.evaluate(async (dates) => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { isWorkingDay } = await import(new URL('js/utils.js', base).href);
        const c = store.getCalendar();
        return Object.fromEntries(dates.map(d => [d, isWorkingDay(d, c)]));
    }, Object.keys(CALENDRIER_SUPPOSE));
    expect(cal, 'le calendrier du compte n\'est pas lundi-vendredi sur ces dates').toEqual(CALENDRIER_SUPPOSE);

    /* DISCRIMINANT — LE SOCLE : l'import n'a rien placé. Ferme « les dates
       attendues viendraient de l'import, pas du moteur ». */
    expect((await lire(page, s, CLES)).dates, 'le socle importé').toBe(
        'A:2026-06-01→2026-06-05 B:2026-06-08→2026-06-10 C:2026-06-11→2026-06-12 '
        + 'D:2026-06-08→2026-06-09 E:2026-06-08→2026-06-09 F:2026-06-10→2026-06-11 G:2026-06-10→2026-06-12');

    /* A glisse : sa fin passe au vendredi 12/06, par sa fiche. */
    const nomA = `A Ancre ${s}`;
    await (await present(page.locator(`.gantt-row .task-name[title="${nomA}"]`), 'nom de A dans le Gantt')).dblclick();
    await expect(fiche(page), 'la fiche de A doit s\'ouvrir').toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#taskName'), 'la fiche ouverte doit être celle de A').toHaveValue(nomA);
    await page.locator('#taskEnd').fill('2026-06-12');
    await (await present(fiche(page).locator('.modal-footer .btn-primary'), 'bouton « Enregistrer »')).click();
    await expect(fiche(page), 'la fiche doit se fermer').toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT — LE MOTEUR A TOURNÉ : A finit le 12, et D, non
       commencée, est poussée au lundi 15. Ferme « rien n'a bougé parce que
       la propagation n'a pas eu lieu » : un vert sans elle ne mesurerait
       rien. Passe avant comme après. */
    await expect.poll(async () => (await lire(page, s, ['A', 'D'])).dates,
        { message: 'A replacée et D poussée par le moteur' })
        .toBe('A:2026-06-01→2026-06-12 D:2026-06-15→2026-06-16');

    // --- L'ASSERTION CENTRALE ---
    /* B, commencée le 08, reste 08 → 10 ; C la suit toujours au 11.
       E, finie le 10, s'étend à sa Fin réelle (08 → 10) ; F se place
       d'après elle, au 11 → 12. G, commencée le 08, y revient, 3 jours
       ouvrés : 08 → 10. */
    expect((await lire(page, s, ['B', 'C', 'E', 'F', 'G'])).dates, 'les tâches commencées restent ancrées').toBe(
        'B:2026-06-08→2026-06-10 C:2026-06-11→2026-06-12 E:2026-06-08→2026-06-10 F:2026-06-11→2026-06-12 G:2026-06-08→2026-06-10');

    /* TÉMOIN — relu de la base après rechargement : l'ancrage a été écrit,
       pas seulement affiché. */
    await page.reload();
    await waitForAppReady(page);
    await expect.poll(async () => (await lire(page, s, CLES)).dates,
        { message: 'après rechargement, relu de la base', timeout: 15_000 }).toBe(
        'A:2026-06-01→2026-06-12 B:2026-06-08→2026-06-10 C:2026-06-11→2026-06-12 '
        + 'D:2026-06-15→2026-06-16 E:2026-06-08→2026-06-10 F:2026-06-11→2026-06-12 G:2026-06-08→2026-06-10');

    await deleteActiveProject(page);
});
