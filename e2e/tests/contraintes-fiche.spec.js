import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 : la fiche d'une tâche permet de poser une
 * contrainte de date (« Doit finir le », « Début au plus tôt le »…), comme
 * dans MS Project.
 *
 * LE BESOIN. Depuis les PR 1 à 6 (#113 à #118), une tâche garde sa
 * contrainte en base, le moteur la place selon elle, et les marges comme le
 * rapport DCMA en tiennent compte. Mais AUCUNE INTERFACE NE LA POSE : seul
 * un fichier JSON fabriqué à la main en porte une. La fiche n'a ni
 * sélecteur de contrainte ni date de contrainte.
 *
 * CE QUE LA FICHE DOIT FAIRE, et que ce fichier vérifie, tout par
 * l'interface :
 *   1. poser « Doit finir le » ; refuser un type sans date (la fiche reste
 *      ouverte, la date en erreur, un message en alerte) ; annoncer AVANT
 *      d'enregistrer qu'une date posée un samedi sera tenue le vendredi ;
 *      enregistrer, puis relire la contrainte en rouvrant la fiche, avant
 *      et après un rechargement ;
 *   2. se laisser annuler par Ctrl+Z, d'un seul coup, comme toute édition ;
 *   3. dire AVANT d'enregistrer qu'une contrainte rompra un lien entrant
 *      (la contrainte l'emporte, décision de l'utilisateur) : le nom du
 *      prédécesseur, la date qu'il exige, celle que la contrainte tiendrait
 *      et l'écart en jours ouvrés ;
 *   4. offrir la ligne pour un jalon et un permis, pas pour une phase.
 *
 * LE JEU, importé par le bouton « Importer » (A, J, P et Ph à leurs dates,
 * B LOIN de sa place, sans lien) :
 *   A   lundi 01 → vendredi 05/06/2026 ;
 *   B   3 jours ouvrés, posée 22 → 24/06, que chaque test lie à A en
 *       Fin→Début PAR SA FICHE : le moteur la place alors 08 → 10/06 ;
 *   J   jalon du lundi 22/06 ; P permis 22 → 26/06 ; Ph phase, et E,
 *       son unique enfant, 01 → 05/06.
 * JUIN 2026 COMMENCE UN LUNDI et n'a aucun férié ; le 13 est un samedi.
 *
 * LE COMPTE EST PARTAGÉ. Chaque test importe son propre projet, au nom
 * suffixé, confié au filet de nettoyage dès qu'il est actif et supprimé à la
 * fin. Les tâches sont lues par NOM, jamais comptées. La vue Gantt est
 * posée et relue, le zoom « jour » posé et relu (il est hérité des
 * réglages du compte) ; la fiche s'ouvre par un double-clic sur le nom,
 * dans la colonne de gauche du Gantt.
 *
 * HORS DE CETTE PR (renvoyé à la PR 8, qui apporte le détecteur de
 * conflits) : le toast après l'enregistrement d'un lien rompu, et le
 * message de conflit dans la fiche rouverte. Le test 3 s'arrête à
 * l'aperçu et au placement enregistré.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 4 failed, chacun sur l'assertion
 * de présence du sélecteur, « sélecteur de contrainte absent de la fiche ».
 * Les discriminants qui la précèdent passent. */

const FICHE = '#taskModalOverlay';

function jeu(suffixe) {
    const tache = (id, nom, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${nom} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesFiche ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-22', '2026-06-24', 1),
            tache('jeu-j', 'J Réception', '2026-06-22', '2026-06-22', 2, { isMilestone: true }),
            tache('jeu-p', 'P Permis de construire', '2026-06-22', '2026-06-26', 3, {
                isPermit: true, permitType: 'PC', permitStatus: 'draft',
            }),
            tache('jeu-ph', 'Ph Gros œuvre', '2026-06-01', '2026-06-05', 4, { isPhase: true }),
            tache('jeu-e', 'E Élévation', '2026-06-01', '2026-06-05', 5, { parentId: 'jeu-ph' }),
        ],
        resources: [],
    };
}

/* Ce que les attendus supposent du calendrier : lundi-vendredi, aucun férié
   du 4 au 15 juin. */
const CALENDRIER_SUPPOSE = {
    '2026-06-04': true, '2026-06-05': true, '2026-06-06': false, '2026-06-07': false,
    '2026-06-08': true, '2026-06-10': true, '2026-06-12': true, '2026-06-13': false,
    '2026-06-14': false, '2026-06-15': true,
};

/** Toute action est précédée d'une assertion de présence qui dit ce qui
 *  manque : un sélecteur qui ne résout plus échoue ici, sous son nom, et non
 *  dans l'action ou comme un faux rouge. */
async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const fiche = (page) => page.locator(FICHE);

/** Dates et contrainte des tâches nommées, lues dans le store VIVANT de la
 *  page, filtrées par nom (le compte est partagé), avec le projet actif. */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            idProjet: store.getActiveProject()?.id ?? null,
            taches: Object.fromEntries(noms.map(n => {
                const t = taches.filter(x => x.name === n);
                if (t.length !== 1) return [n, `${t.length} tâche(s)`];
                const c = t[0].constraintType ? ` ${t[0].constraintType} ${t[0].constraintDate}` : ' dès que possible';
                return [n, `${t[0].startDate}→${t[0].endDate}${c}`];
            })),
        };
    }, noms);
}

/** Ouvre la fiche d'une tâche par un double-clic sur son nom, dans la
 *  colonne de gauche du Gantt, présente à tous les zooms. */
async function ouvrirFiche(page, nom) {
    const cellule = await present(page.locator(`.gantt-row .task-name[title="${nom}"]`), `nom de « ${nom} » dans le Gantt`);
    await cellule.dblclick();
    await expect(fiche(page), `la fiche de « ${nom} » doit s'ouvrir`).toBeVisible({ timeout: 10_000 });
    /* DISCRIMINANT — C'EST BIEN LA FICHE DE CETTE TÂCHE. Ferme « on lit la
       fiche d'une autre tâche ». Passe avant comme après. */
    await expect(page.locator('#taskName'), 'la fiche ouverte doit être celle de la tâche visée').toHaveValue(nom);
}

async function enregistrer(page) {
    const bouton = await present(fiche(page).locator('.modal-footer .btn-primary'), 'bouton « Enregistrer » de la fiche');
    await bouton.click();
}

async function fermerSansEnregistrer(page) {
    const bouton = await present(fiche(page).locator('.modal-footer .btn-secondary'), 'bouton « Annuler » du pied de la fiche');
    await bouton.click();
    await expect(fiche(page), 'la fiche doit se fermer').toBeHidden();
}

/** Le sélecteur de contrainte : l'assertion de présence est la PREMIÈRE de
 *  l'assertion centrale de chaque test. C'est elle qui échoue tant que la
 *  fiche n'a pas la ligne. */
async function selecteurContrainte(page) {
    const sel = page.locator('#taskConstraint');
    await expect(sel, 'sélecteur de contrainte absent de la fiche').toBeVisible();
    return sel;
}

/** Vue Gantt, zoom « jour », calendrier : posés ou relus. */
async function verifierMontage(page, nomProjet) {
    /* DISCRIMINANT — ON REGARDE LE GANTT, AU ZOOM « JOUR ». Vue et zoom sont
       hérités de l'état du compte partagé : la vue est posée puis relue, le
       zoom posé puis relu. Ferme « la colonne des noms n'est pas là » : sans
       la vue Gantt, aucune fiche ne s'ouvrirait par le nom, et l'échec
       viendrait du montage. */
    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour, 'le zoom « jour » n\'est pas actif').toHaveClass(/active/);

    /* DISCRIMINANT — LE CALENDRIER EST CELUI QU'ON CROIT, lu dans le store
       VIVANT (le nom du projet actif le prouve). Ferme « un samedi travaillé
       ou un férié sur mesure, posé par un autre test sur le compte
       partagé, déplace les dates attendues » : l'échec viendrait alors du
       calendrier, pas de la fiche. Passe avant comme après. */
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
}

/** Importe le jeu, vérifie le montage, puis lie B à A en Fin→Début par la
 *  fiche de B. Rend les noms complets. */
async function preparer(page) {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, J, P, Ph] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    /* Nom de fichier explicite avec l'extension : _importProject() trie par
       extension (leçon de import-json.spec.js). */
    await (await selecteur).setFiles({
        name: 'contraintes-fiche.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    /* Le projet devient actif AVANT les écritures en base : il est confié
       au filet de nettoyage dès ce moment. */
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    await verifierMontage(page, nomProjet);

    /* B est liée à A par sa fiche : case de A cochée dans « Précédée par »,
       type Fin→Début (le premier de la liste), décalage 0. */
    await ouvrirFiche(page, B);
    const ligneA = await present(page.locator('#taskPredList > div').filter({ hasText: A }), `ligne de « ${A} » dans « Précédée par »`);
    await (await present(ligneA.locator('input[type="checkbox"]'), 'case de A')).check();
    await expect(ligneA.locator('select'), 'le lien posé doit être Fin→Début').toHaveValue('FS');
    await enregistrer(page);
    await expect(fiche(page), 'la fiche de B doit se fermer après la pose du lien').toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT — LE LIEN EST POSÉ ET LE MOTEUR A PLACÉ B. B, saisie
       22 → 24/06, est relue 08 → 10/06, sans contrainte, et A n'a pas
       bougé. Ferme « le lien n'est pas posé » et « le moteur ne place
       pas » : tout ce qui suit mesure la contrainte à partir de ce socle.
       Passe avant comme après. */
    const socle = await lire(page, [A, B]);
    expect(socle.taches, 'le lien A → B n\'a pas placé B au 08 → 10/06').toEqual({
        [A]: '2026-06-01→2026-06-05 dès que possible',
        [B]: '2026-06-08→2026-06-10 dès que possible',
    });
    return { nomProjet, idProjet: socle.idProjet, A, B, J, P, Ph };
}

test('poser « Doit finir le » dans la fiche : refus sans date, aperçu du samedi, relu à la réouverture et après rechargement', async ({ page }) => {
    const { nomProjet, idProjet, A, B } = await preparer(page);
    await ouvrirFiche(page, B);

    // --- L'ASSERTION CENTRALE ---
    const sel = await selecteurContrainte(page);
    const date = await present(page.locator('#taskConstraintDate'), 'champ « Date de contrainte »');
    const apercu = await present(page.locator('#taskConstraintInfo'), 'aperçu de la contrainte');
    await expect(date, '« Dès que possible » : la date de contrainte est désactivée').toBeDisabled();

    /* « Doit finir le » sans date : refusé, fiche ouverte, date en erreur,
       message en alerte. La fiche pré-remplit la date avec la fin actuelle
       (comme MS Project) : on la vide. */
    await sel.selectOption('MFO');
    await expect(date, 'la date de contrainte doit s\'activer').toBeEnabled();
    await date.fill('');
    await enregistrer(page);
    /* La classe, pas la visibilité : à la fermeture, la fiche reste visible
       le temps de sa transition (components.css, .modal-overlay), et un
       toBeVisible() passerait sur une fiche qui se ferme. close() retire
       la classe dans le gestionnaire même du clic. */
    await expect(fiche(page), 'un type sans date ne doit pas fermer la fiche').toHaveClass(/\bactive\b/);
    await expect(date, 'la date manquante doit être marquée en erreur').toHaveClass(/input-error/);
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#taskConstraintError'), 'le message doit être une alerte')
        .toHaveAttribute('role', 'alert');
    await expect(page.locator('#taskConstraintError'), 'le message doit demander la date')
        .toContainText('Doit finir le');
    expect((await lire(page, [B])).taches[B], 'rien ne doit être enregistré')
        .toBe('2026-06-08→2026-06-10 dès que possible');

    /* Samedi 13/06 : l'aperçu dit, AVANT d'enregistrer, que la tâche
       finira le vendredi 12, et où elle sera placée. */
    await date.fill('2026-06-13');
    await expect(apercu, 'l\'aperçu doit annoncer le vendredi')
        .toContainText('Le samedi 13/06/2026 n\'est pas ouvré : la tâche finira le vendredi 12/06/2026.');
    await expect(apercu, 'l\'aperçu doit annoncer le placement')
        .toContainText('du mercredi 10/06/2026 au vendredi 12/06/2026');
    await expect(apercu, 'le lien avec A tient : aucun lien rompu annoncé').not.toContainText('Lien rompu');
    await expect(date, 'la saisie corrigée efface l\'erreur').not.toHaveClass(/input-error/);

    await enregistrer(page);
    await expect(fiche(page), 'la fiche doit se fermer à l\'enregistrement').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [B])).taches[B], 'B doit finir le vendredi 12, contrainte saisie gardée')
        .toBe('2026-06-10→2026-06-12 MFO 2026-06-13');

    await ouvrirFiche(page, B);
    await expect(sel, 'rouverte, la fiche relit le type').toHaveValue('MFO');
    await expect(date, 'rouverte, la fiche relit la date saisie (le samedi)').toHaveValue('2026-06-13');
    await fermerSansEnregistrer(page);

    /* Le rechargement fait relire la base. */
    await page.reload();
    await waitForAppReady(page);
    /* DISCRIMINANT — LE PROJET ROUVERT EST CELUI DU TEST. Ferme « on relit
       un autre projet du compte partagé ». Passe avant comme après (non
       atteint avant). */
    expect((await lire(page, [])).idProjet, 'après rechargement, le projet actif doit être celui du test').toBe(idProjet);
    await verifierMontage(page, nomProjet);
    expect((await lire(page, [A, B])).taches, 'après rechargement, A et B relues de la base').toEqual({
        [A]: '2026-06-01→2026-06-05 dès que possible',
        [B]: '2026-06-10→2026-06-12 MFO 2026-06-13',
    });
    await ouvrirFiche(page, B);
    await expect(page.locator('#taskConstraint'), 'après rechargement, la fiche relit le type').toHaveValue('MFO');
    await expect(page.locator('#taskConstraintDate'), 'après rechargement, la fiche relit la date').toHaveValue('2026-06-13');
    await fermerSansEnregistrer(page);

    await deleteActiveProject(page);
});

test('Ctrl+Z tout de suite après l\'enregistrement d\'une contrainte la retire, et B revient au 08 → 10/06', async ({ page }) => {
    const { B } = await preparer(page);
    await ouvrirFiche(page, B);

    // --- L'ASSERTION CENTRALE ---
    const sel = await selecteurContrainte(page);
    await sel.selectOption('MFO');
    await (await present(page.locator('#taskConstraintDate'), 'champ « Date de contrainte »')).fill('2026-06-12');
    await enregistrer(page);
    await expect(fiche(page), 'la fiche doit se fermer à l\'enregistrement').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [B])).taches[B], 'la contrainte est enregistrée').toBe('2026-06-10→2026-06-12 MFO 2026-06-12');

    /* Aucune autre écriture avant : Ctrl+Z annule l'enregistrement de la
       fiche, et lui seul. B revient où le lien l'avait mise, sans
       contrainte ; un Ctrl+Z qui annulerait aussi la pose du lien la
       ramènerait au 22 → 24/06. */
    await page.keyboard.press('Control+z');
    await expect(page.locator('#toastContainer .toast', { hasText: 'Action annulée' }),
        'Ctrl+Z doit annuler une action').toBeVisible({ timeout: 10_000 });
    expect((await lire(page, [B])).taches[B], 'après Ctrl+Z, B revient au 08 → 10/06 sans contrainte')
        .toBe('2026-06-08→2026-06-10 dès que possible');
    await ouvrirFiche(page, B);
    await expect(page.locator('#taskConstraint'), 'rouverte, la fiche dit « Dès que possible »').toHaveValue('');
    await expect(page.locator('#taskConstraintDate')).toHaveValue('');
    await fermerSansEnregistrer(page);

    await deleteActiveProject(page);
});

test('l\'aperçu dit, avant d\'enregistrer, qu\'une « Doit commencer le » rompra le lien avec A', async ({ page }) => {
    const { A, B } = await preparer(page);
    await ouvrirFiche(page, B);

    // --- L'ASSERTION CENTRALE ---
    const sel = await selecteurContrainte(page);
    const date = await present(page.locator('#taskConstraintDate'), 'champ « Date de contrainte »');
    const apercu = await present(page.locator('#taskConstraintInfo'), 'aperçu de la contrainte');
    await sel.selectOption('MSO');

    /* TÉMOIN — une « Doit commencer le 08/06 » est tenue par le lien : rien
       n'est annoncé rompu. Ferme « tout lien vers une tâche contrainte est
       annoncé rompu ». */
    await date.fill('2026-06-08');
    await expect(apercu, 'MSO 08/06 : le placement est annoncé').toContainText('du lundi 08/06/2026 au mercredi 10/06/2026');
    await expect(apercu, 'MSO 08/06 tient le lien : rien n\'est annoncé rompu').not.toContainText('Lien rompu');

    await date.fill('2026-06-04');
    await expect(apercu, 'MSO 04/06 : l\'aperçu doit dire le lien rompu, la date exigée, la date tenue et l\'écart')
        .toContainText(`Lien rompu avec « ${A} » : il exige le lundi 08/06/2026, la contrainte tiendrait le jeudi 04/06/2026, 2 jours ouvrés plus tôt.`);
    await expect(apercu, 'MSO 04/06 : le placement est annoncé').toContainText('du jeudi 04/06/2026 au lundi 08/06/2026');

    /* L'aperçu disait vrai : la contrainte l'emporte, B est placée 04 → 08. */
    await enregistrer(page);
    await expect(fiche(page), 'la fiche doit se fermer à l\'enregistrement').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [B])).taches[B], 'enregistrée, B est placée comme l\'aperçu l\'annonçait')
        .toBe('2026-06-04→2026-06-08 MSO 2026-06-04');

    await deleteActiveProject(page);
});

test('la ligne de contrainte est présente pour un jalon et un permis, absente pour une phase', async ({ page }) => {
    const { J, P, Ph } = await preparer(page);

    // --- L'ASSERTION CENTRALE ---
    await ouvrirFiche(page, J);
    const sel = await selecteurContrainte(page);
    /* Un jalon contraint : « Doit finir le » samedi 13/06 le pose le
       vendredi 12. */
    await sel.selectOption('MFO');
    await (await present(page.locator('#taskConstraintDate'), 'champ « Date de contrainte »')).fill('2026-06-13');
    await expect(page.locator('#taskConstraintInfo'), 'l\'aperçu du jalon').toContainText('le vendredi 12/06/2026');
    await enregistrer(page);
    await expect(fiche(page), 'la fiche du jalon doit se fermer').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [J])).taches[J], 'le jalon est posé le vendredi 12').toBe('2026-06-12→2026-06-12 MFO 2026-06-13');

    await ouvrirFiche(page, P);
    await expect(page.locator('#taskConstraint'), 'la ligne de contrainte doit figurer dans la fiche d\'un permis').toBeVisible();
    await fermerSansEnregistrer(page);

    await ouvrirFiche(page, Ph);
    /* DISCRIMINANT — C'EST BIEN UNE FICHE DE PHASE, et elle est affichée :
       le nom est visible, les dates masquées. Ferme « la ligne est absente
       parce que la fiche ne s'affiche pas » et « ce n'est pas une phase ». */
    await expect(page.locator('#taskName'), 'le nom de la phase est affiché').toBeVisible();
    await expect(page.locator('#taskStart'), 'une phase n\'a pas de dates à saisir').toBeHidden();
    await expect(page.locator('#taskConstraint'), 'pas de contrainte pour une phase').toBeHidden();
    await fermerSansEnregistrer(page);

    await deleteActiveProject(page);
});
