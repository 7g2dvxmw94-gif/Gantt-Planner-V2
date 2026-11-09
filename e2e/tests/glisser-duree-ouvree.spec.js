import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer) croisé avec le calendrier
 * ouvré.
 *
 * LE DÉFAUT : une tâche glissée par-dessus un week-end perd des jours
 * ouvrés. Au lâcher, _finishDrag() (gantt-interactions.js) garde l'écart
 * CALENDAIRE entre début et fin :
 *
 *     const origDuration = daysBetween(parseISO(d.origStartDate), parseISO(d.origEndDate));
 *     updates.endDate = formatDateISO(addDays(newStart, origDuration));
 *
 * Tout le reste de l'application compte la durée en jours OUVRÉS : le
 * champ « Durée » de la fiche (task-modal.js), le recalage à la saisie
 * (_snapToWorkingDays, « durée ouvrée préservée »), et le moteur de
 * liens (_computeConstrainedDates, store.js), qui relit la durée en jours
 * ouvrés sur les dates qu'on vient de lui écrire. Deux implémentations de
 * la même règle, qui divergent dès qu'un week-end entre dans la barre.
 *
 * MESURÉ par l'interface, sur l'application entière (harnais à faux
 * Supabase, main 721fe06), zoom « jour », glisser de quatre colonnes :
 *   - tâche libre, lundi 8 → mercredi 10 juin (3 jours ouvrés) : relue
 *     vendredi 12 → dimanche 14, soit 1 jour ouvré ;
 *   - tâche liée en Fin→Début à une tâche finissant le vendredi 5, même
 *     dates : lâchée vendredi 12 → dimanche 14, le moteur relit 1 jour
 *     ouvré et la recale lundi 8 → lundi 8.
 * Glissées de deux colonnes (lâchées mercredi 10 → vendredi 12, sans
 * week-end), les deux gardent leurs 3 jours. Mesuré de même :
 *   - au zoom « semaine », la libre lâchée le samedi 13 finit le lundi 15,
 *     1 jour ouvré ; la liée est recalée lundi 8 → lundi 8 ;
 *   - par-dessus le férié du mardi 14 juillet, lundi 6 → mercredi 8
 *     juillet lâchée le lundi 13 finit le mercredi 15 : 2 jours ouvrés ;
 *   - dans l'autre sens, une tâche qui enjambait un week-end en GAGNE :
 *     jeudi 11 → mardi 16 juin (4 jours ouvrés), glissée de trois colonnes
 *     vers la gauche, finit le samedi 13 avec 5 jours ouvrés.
 *
 * L'ATTENDU : la durée ouvrée lue dans la fiche AVANT le glisser se
 * retrouve dans la fiche APRÈS. Lâchée le vendredi 12, la tâche de 3 jours
 * ouvrés finit le mardi 16 (vendredi 12, lundi 15, mardi 16).
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : chacun des deux tests échoue
 * sur son assertion centrale (fin du 14 au lieu du 16 et durée 1 pour la
 * libre ; fin du 8 au lieu du 10 et durée 1 pour la liée). Tous les
 * discriminants passent. gantt-drag.spec.js, dont l'attendu est corrigé
 * dans le même commit, échoue aussi, sur sa date de fin.
 *
 * JUIN 2026 COMMENCE UN LUNDI.
 */

const AMONT_DEBUT = '2026-06-01';   // lundi
const AMONT_FIN   = '2026-06-05';   // vendredi

const ORIG_DEBUT = '2026-06-08';    // lundi
const ORIG_FIN   = '2026-06-10';    // mercredi — trois jours ouvrés

/* La liée naît plus loin que sa position contrainte, avec la même durée
   ouvrée : le lien doit la tirer à ORIG_DEBUT → ORIG_FIN, ce qui prouve
   qu'il s'applique. */
const LIEE_SAISIE_DEBUT = '2026-06-10';  // mercredi
const LIEE_SAISIE_FIN   = '2026-06-12';  // vendredi — trois jours ouvrés

/* Quatre colonnes au zoom « jour » : le lundi 8 tombe le vendredi 12, et la
   barre de trois jours ouvrés enjambe le week-end des 13 et 14. */
const COLONNES     = 4;
const LACHE_DEBUT  = '2026-06-12';  // vendredi
const ATTENDU_FIN  = '2026-06-16';  // mardi : vendredi 12, lundi 15, mardi 16

/* Ce que l'attendu suppose du calendrier, jour par jour, du 8 au 16 juin. */
const CALENDRIER_SUPPOSE = {
    '2026-06-08': true, '2026-06-09': true, '2026-06-10': true,
    '2026-06-11': true, '2026-06-12': true,
    '2026-06-13': false, '2026-06-14': false,
    '2026-06-15': true, '2026-06-16': true,
};

/** Toute action est précédée d'une assertion de présence qui dit ce qui
 *  manque : un sélecteur qui ne résout plus doit échouer ici, sous son nom,
 *  et non expirer dans l'action ou passer pour un rouge. */
async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const fiche = (page) => page.locator('#taskModalOverlay');
const barreDe = (page, nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });

async function fermee(page) {
    await expect(fiche(page)).toBeHidden({ timeout: 15_000 });
}

/** Ouvre la fiche de création, saisit nom et dates, coche les
 *  prédécesseurs, crée. */
async function creer(page, { nom, debut, fin, predecesseurs = [] }) {
    await (await present(page.locator('#addTaskBtn'), 'bouton d\'ajout de tâche')).click();
    await expect(fiche(page)).toBeVisible();
    await (await present(page.locator('#taskName'), 'champ du nom')).fill(nom);
    await (await present(page.locator('#taskStart'), 'champ de début')).fill(debut);
    await (await present(page.locator('#taskEnd'), 'champ de fin')).fill(fin);
    for (const amont of predecesseurs) {
        const groupe = page.locator('.form-group',
            { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
        const caseAmont = groupe.locator('.dep-list > div').filter({ hasText: amont })
            .locator('input[type="checkbox"]');
        await present(caseAmont, `« ${amont} » dans la liste « Précédée par »`);
        await caseAmont.check();
    }
    await (await present(page.getByRole('button', { name: 'Créer' }), 'bouton « Créer »')).click();
    /* L'overlay reste cliquable ~200 ms après la fermeture et avalerait le
       mousedown du glisser qui suit (gantt-drag.spec.js documente le piège). */
    await fermee(page);
    await expect(barreDe(page, nom), `barre de « ${nom} »`).toBeVisible({ timeout: 10_000 });
}

/** Rouvre une tâche, lit début, fin et durée affichée, referme SANS
 *  enregistrer. La durée est celle du champ « Durée » de la fiche : un
 *  nombre de jours ouvrés, compté par l'application sur son calendrier. */
async function lireFiche(page, nom) {
    await (await present(barreDe(page, nom), `barre de « ${nom} »`)).dblclick();
    await expect(fiche(page)).toBeVisible();
    const lu = {
        debut: await (await present(page.locator('#taskStart'), 'champ de début')).inputValue(),
        fin:   await (await present(page.locator('#taskEnd'), 'champ de fin')).inputValue(),
        duree: await (await present(page.locator('#taskDuration'), 'champ de durée')).inputValue(),
    };
    await (await present(fiche(page).locator('button.btn-secondary', { hasText: 'Annuler' }),
        'bouton « Annuler » de la fiche')).click();
    await fermee(page);
    return lu;
}

/** Glisse la barre de `colonnes` colonnes vers la droite et rend de combien
 *  de colonnes la barre a suivi la souris AVANT le lâcher. La largeur d'une
 *  colonne est mesurée dans le DOM, pas supposée. */
async function glisser(page, nom, colonnes) {
    const barre = await present(barreDe(page, nom), `barre de « ${nom} »`);
    const colonne = await present(page.locator('.gantt-timeline-grid-col').first(),
        'colonne de la grille du Gantt');
    const largeur = await colonne.evaluate(el => el.getBoundingClientRect().width);
    const gauche = () => barre.evaluate(el => parseFloat(el.style.left));

    const avant = await gauche();
    const boite = await barre.boundingBox();
    const x = boite.x + boite.width / 2;
    const y = boite.y + boite.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + colonnes * largeur, y, { steps: 10 });
    const pendant = await gauche();
    await page.mouse.up();
    return (pendant - avant) / largeur;
}

/** Branche sur le store VIVANT de la page un journal des dates écrites dans
 *  la tâche `nom`, dans l'ordre. Au lâcher, _finishDrag() écrit d'abord ce
 *  que la souris a pointé (updateTask), puis le recalage par les liens
 *  (applyPredecessorConstraints) réécrit les dates ; chacun émet
 *  « task:update ». Les dates sont COPIÉES à l'émission : le recalage
 *  modifie ensuite le même objet sur place. */
async function journaliser(page, nom) {
    await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        window.__ecrituresGlisser = [];
        store.on('task:update', (t) => {
            if (t && t.name === nom) window.__ecrituresGlisser.push({ debut: t.startDate, fin: t.endDate });
        });
    }, nom);
}
const ecritures = (page) => page.evaluate(() => window.__ecrituresGlisser);

/** Ce que les deux tests vérifient avant de glisser quoi que ce soit. */
async function monter(page, nomProjet) {
    await page.goto('index.html');
    await createProject(page, nomProjet);

    /* DISCRIMINANT — ON REGARDE BIEN LE GANTT. La vue active est relue du
       localStorage du contexte (l'état de session écrit par auth.setup.js) :
       on vérifie qu'elle est celle qu'on croit, sans quoi aucune barre ne
       serait là pour être glissée. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT — LE ZOOM EST CELUI QU'ON CROIT. Relu des réglages du
       compte, donc héritable d'un autre test : on le pose et on vérifie
       qu'il a pris. Au zoom « jour », une colonne vaut un jour ; ailleurs,
       quatre colonnes ne mèneraient pas au vendredi 12. */
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT — LE CALENDRIER EST CELUI QU'ON CROIT. Il est relu des
       réglages du compte partagé ; un samedi travaillé, ou un férié sur
       mesure posé le 15 ou le 16, déplacerait la fin attendue, et l'échec
       viendrait alors du calendrier, pas du glisser. On lit le calendrier
       du store VIVANT de la page : le nom du projet actif prouve que le
       module importé est bien l'instance de l'application, et non une
       instance neuve au calendrier par défaut, qui passerait toujours. */
    const lu = await page.evaluate(async (dates) => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { isWorkingDay } = await import(new URL('js/utils.js', base).href);
        const cal = store.getCalendar();
        return {
            projet: store.getActiveProject()?.name ?? null,
            ouvres: Object.fromEntries(dates.map(d => [d, isWorkingDay(d, cal)])),
        };
    }, Object.keys(CALENDRIER_SUPPOSE));
    expect(lu.projet, 'le store lu n\'est pas celui de l\'application').toBe(nomProjet);
    expect(lu.ouvres, 'le calendrier du compte n\'est pas lundi-vendredi sur ces dates')
        .toEqual(CALENDRIER_SUPPOSE);
}

test('une tâche libre glissée par-dessus un week-end garde ses jours ouvrés', async ({ page }) => {
    const suffixe = Date.now();
    const nomLibre = `Ragréage ${suffixe}`;

    await monter(page, `E2E GlisserDureeOuvree ${suffixe}`);
    await creer(page, { nom: nomLibre, debut: ORIG_DEBUT, fin: ORIG_FIN });

    /* La durée d'origine est LUE dans la fiche, pas supposée : c'est elle
       que le glisser doit conserver. Ses dates confirment que la saisie a
       été prise telle quelle. */
    const avant = await lireFiche(page, nomLibre);
    expect(avant, 'la tâche n\'a pas été créée aux dates saisies, ou sa durée ouvrée n\'est pas 3')
        .toEqual({ debut: ORIG_DEBUT, fin: ORIG_FIN, duree: '3' });

    /* DISCRIMINANT — LA BARRE A SUIVI LA SOURIS, de quatre colonnes
       exactement. Ferme « le mousedown a été avalé » et « un défilement
       automatique a ajouté des colonnes ». */
    expect(await glisser(page, nomLibre, COLONNES), 'la barre n\'a pas suivi la souris de quatre colonnes')
        .toBe(COLONNES);

    const apres = await lireFiche(page, nomLibre);

    /* DISCRIMINANT — LE GLISSER A EU LIEU : le début a changé, et il est
       là où la souris l'a lâché. Ferme « rien n'a bougé, donc la durée est
       intacte » : sans ce contrôle, un glisser qui n'aurait pas pris
       passerait l'assertion centrale. */
    expect(apres.debut, 'le début n\'est pas là où la souris a lâché la barre').toBe(LACHE_DEBUT);

    // --- L'ASSERTION CENTRALE ---
    expect({ fin: apres.fin, duree: apres.duree },
        'la tâche glissée par-dessus le week-end n\'a pas gardé sa durée ouvrée')
        .toEqual({ fin: ATTENDU_FIN, duree: avant.duree });

    await deleteActiveProject(page);
});

test('une tâche liée glissée par-dessus un week-end garde ses jours ouvrés', async ({ page }) => {
    const suffixe = Date.now();
    const nomAmont = `Fondations ${suffixe}`;
    const nomLiee  = `Élévation ${suffixe}`;

    await monter(page, `E2E GlisserDureeOuvreeLiee ${suffixe}`);
    await creer(page, { nom: nomAmont, debut: AMONT_DEBUT, fin: AMONT_FIN });
    await creer(page, { nom: nomLiee, debut: LIEE_SAISIE_DEBUT, fin: LIEE_SAISIE_FIN,
        predecesseurs: [nomAmont] });

    /* DISCRIMINANT — LE LIEN S'APPLIQUE. Saisie du mercredi 10 au vendredi
       12, la liée est tirée au lundi 8 (fin de l'amont + 1 = samedi 6,
       recalé au lundi) en gardant ses trois jours ouvrés. Ferme « la tâche
       n'est pas liée » : sans lien, le moteur ne relirait rien au lâcher.
       La durée lue ici est celle que le glisser doit conserver. */
    const avant = await lireFiche(page, nomLiee);
    expect(avant, 'la tâche liée n\'a pas été placée par son prédécesseur en gardant 3 jours ouvrés')
        .toEqual({ debut: ORIG_DEBUT, fin: ORIG_FIN, duree: '3' });

    await journaliser(page, nomLiee);

    /* DISCRIMINANT — LA BARRE A SUIVI LA SOURIS, de quatre colonnes. Ferme
       « le mousedown a été avalé ». Le moteur ramène ensuite la liée au
       lundi 8 : un glisser qui n'aurait pas pris laisserait exactement les
       dates attendues. */
    expect(await glisser(page, nomLiee, COLONNES), 'la barre n\'a pas suivi la souris de quatre colonnes')
        .toBe(COLONNES);

    /* DISCRIMINANT — LE GLISSER A EU LIEU : la première écriture qui suit le
       lâcher porte le début du vendredi 12, là où la souris a lâché la
       barre. La barre a pu suivre la souris sans que le lâcher écrive quoi
       que ce soit ; une fois le défaut corrigé, la liée finirait alors aux
       dates exactes d'avant le glisser, et l'assertion centrale passerait
       sans rien mesurer. */
    const ecrit = await ecritures(page);
    expect(ecrit[0]?.debut, 'le lâcher n\'a pas écrit dans la tâche liée le début où la souris l\'a lâchée')
        .toBe(LACHE_DEBUT);

    const apres = await lireFiche(page, nomLiee);

    /* DISCRIMINANT — LE RECALAGE A EU LIEU : le début est revenu au lundi
       8, imposé par le lien. Ferme « la tâche est restée où la souris l'a
       lâchée » : l'écart viendrait alors du glisser seul, pas de la durée
       que le moteur relit. */
    expect(apres.debut, 'la tâche liée n\'a pas été ramenée par son prédécesseur').toBe(ORIG_DEBUT);

    // --- L'ASSERTION CENTRALE ---
    expect({ fin: apres.fin, duree: apres.duree },
        'la tâche liée glissée par-dessus le week-end n\'a pas gardé sa durée ouvrée')
        .toEqual({ fin: ORIG_FIN, duree: avant.duree });

    await deleteActiveProject(page);
});
