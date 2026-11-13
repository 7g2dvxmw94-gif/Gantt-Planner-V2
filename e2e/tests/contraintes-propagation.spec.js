import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B7 (dépendances) et § D1 (propagation), sous
 * l'angle des CONTRAINTES DE DATE : une « Doit finir le » arrête l'onde
 * d'un retard amont.
 *
 * LE BESOIN. La contrainte l'emporte sur les liens (décision de
 * l'utilisateur, comme MS Project par défaut). Quand un prédécesseur
 * glisse, la propagation (propagateDependencies, store.js) replace chaque
 * successeur par _computeConstrainedDates() — qui ignore aujourd'hui la
 * contrainte. Une tâche « Doit finir le 10 juin » est donc poussée au 17,
 * et ses propres successeurs avec elle.
 *
 * LE JEU, importé par le bouton « Importer », qui pose plusieurs
 * contraintes d'un coup (la fiche le permet aussi, une tâche à la fois) :
 *   A  lundi 01 → vendredi 05/06/2026 ;
 *   B  Fin→Début de A, « Doit finir le » 10/06 (MFO), posée 08 → 10/06 ;
 *   C  Fin→Début de B, posée 11 → 12/06 ;
 *   D  TÉMOIN, Fin→Début de A sans contrainte, posée 08 → 10/06.
 * Puis, dans la fiche de A, on pose 08 → 12/06 : A finit une semaine plus
 * tard.
 *
 * L'ATTENDU. D suit A et passe au 15 → 17/06. B, elle, tient sa date : elle
 * finit le 10, donc reste 08 → 10/06 (le lien Fin→Début de A est alors
 * rompu ; le signaler est l'objet d'une PR suivante). C suit B, pas A :
 * elle reste 11 → 12/06.
 *
 * MESURÉ (application entière, faux Supabase à mémoire) sur origin/main
 * a3d3cdf : B passe au 15 → 17/06 et C au 18 → 19/06.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « B : début 2026-06-15 au lieu de 2026-06-08 ». Les
 * discriminants passent. JUIN 2026 COMMENCE UN LUNDI. */

/** Le fichier importé : la forme d'un export (projet, tâches, ressources). */
function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const fs = (taskId) => [{ taskId, type: 'FS', lag: 0 }];
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesPropagation ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-08', '2026-06-10', 1, {
                dependencies: fs('jeu-a'), constraintType: 'MFO', constraintDate: '2026-06-10',
            }),
            tache('jeu-c', 'C Élévation', '2026-06-11', '2026-06-12', 2, { dependencies: fs('jeu-b') }),
            tache('jeu-d', 'D Réseaux', '2026-06-08', '2026-06-10', 3, { dependencies: fs('jeu-a') }),
        ],
        resources: [],
    };
}

/* Ce que l'attendu suppose du calendrier, du 1er au 19 juin. */
const CALENDRIER_SUPPOSE = {
    '2026-06-05': true, '2026-06-06': false, '2026-06-07': false, '2026-06-08': true,
    '2026-06-10': true, '2026-06-12': true, '2026-06-13': false, '2026-06-14': false,
    '2026-06-15': true, '2026-06-17': true,
};

/** Toute action est précédée d'une assertion de présence qui dit ce qui
 *  manque : un sélecteur qui ne résout plus échoue ici, sous son nom, et
 *  non dans l'action ou comme un faux rouge. */
async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const fiche = (page) => page.locator('#taskModalOverlay');
const barreDe = (page, nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });

/** Dates des tâches nommées, lues dans le store VIVANT de la page, filtrées
 *  par nom (le compte est partagé), avec le nom du projet actif. */
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

test('une « Doit finir le » tient sa date quand son prédécesseur glisse, et arrête l\'onde', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, C, D] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    /* Le sélecteur de fichier est attendu AVANT le clic qui l'ouvre. */
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'contraintes-propagation.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — ON REGARDE BIEN LE GANTT, AU ZOOM « JOUR ». Vue et
       zoom sont hérités de l'état du compte partagé : la vue est relue, le
       zoom posé puis relu, faute de quoi la barre de A ne serait pas là
       pour ouvrir sa fiche. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT — LE CALENDRIER EST CELUI QU'ON CROIT, lu dans le store
       VIVANT (le nom du projet actif le prouve). Un samedi travaillé ou un
       férié sur mesure posé par un autre test déplacerait les dates
       attendues, et l'échec viendrait du calendrier. */
    const cal = await page.evaluate(async (dates) => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { isWorkingDay } = await import(new URL('js/utils.js', base).href);
        const c = store.getCalendar();
        return { projet: store.getActiveProject()?.name ?? null,
                 ouvres: Object.fromEntries(dates.map(d => [d, isWorkingDay(d, c)])) };
    }, Object.keys(CALENDRIER_SUPPOSE));
    expect(cal.projet, 'le store lu n\'est pas celui de l\'application').toBe(nomProjet);
    expect(cal.ouvres, 'le calendrier du compte n\'est pas lundi-vendredi sur ces dates').toEqual(CALENDRIER_SUPPOSE);

    /* DISCRIMINANT — L'IMPORT N'A RIEN DÉPLACÉ. B est relue 08 → 10/06
       AVANT la modification de A. Ferme « l'import a déjà déplacé B » :
       l'assertion centrale porterait alors sur l'import, pas sur la
       propagation. Avec C et D, le jeu est bien celui qu'on croit. */
    const avant = await lire(page, [A, B, C, D]);
    expect(avant.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [A]: '2026-06-01→2026-06-05', [B]: '2026-06-08→2026-06-10',
        [C]: '2026-06-11→2026-06-12', [D]: '2026-06-08→2026-06-10',
    });

    /* Dans la fiche de A : 08 → 12/06. */
    await (await present(barreDe(page, A), `barre de « ${A} »`)).dblclick();
    await expect(fiche(page), 'la fiche de A doit s\'ouvrir').toBeVisible();
    await (await present(page.locator('#taskStart'), 'champ de début')).fill('2026-06-08');
    await (await present(page.locator('#taskEnd'), 'champ de fin')).fill('2026-06-12');
    await (await present(fiche(page).getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer » de la fiche')).click();
    await expect(fiche(page), 'la fiche de A doit se fermer').toBeHidden({ timeout: 15_000 });

    const apres = await lire(page, [A, B, C, D]);

    /* DISCRIMINANT — A A BOUGÉ, ET LA PROPAGATION A EU LIEU. A est relue
       08 → 12/06 (le champ de date a pris la valeur telle quelle), et le
       témoin D, liée à A sans contrainte, passe au 15 → 17/06. Ferme « A
       n'a pas bougé » et « la propagation n'a pas eu lieu » : B serait
       alors restée en place sans que sa contrainte y soit pour rien. */
    expect({ A: apres.dates[A], D: apres.dates[D] }, 'A n\'a pas bougé, ou le témoin D ne l\'a pas suivie')
        .toEqual({ A: '2026-06-08→2026-06-12', D: '2026-06-15→2026-06-17' });

    // --- L'ASSERTION CENTRALE ---
    const [bDebut] = apres.dates[B].split('→');
    expect({ B: apres.dates[B], C: apres.dates[C] },
        `B : début ${bDebut} au lieu de 2026-06-08 (B ${apres.dates[B]}, C ${apres.dates[C]})`)
        .toEqual({ B: '2026-06-08→2026-06-10', C: '2026-06-11→2026-06-12' });

    await deleteActiveProject(page);
});
