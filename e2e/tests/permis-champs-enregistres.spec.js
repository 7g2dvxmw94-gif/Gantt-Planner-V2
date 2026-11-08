import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (créer un permis de construire), volet
 * persistance : le n° de dossier, la commune et le service instructeur
 * saisis dans la fiche doivent survivre à un rechargement.
 *
 * LE DÉFAUT. Deux noms pour un même champ. La fiche (task-modal.js,
 * _getPermitData et _fillPermitFields) écrit et relit `permitDossier`,
 * `permitCommune` et `permitService` ; le Gantt et son infobulle lisent
 * `permitDossier`. Les mappeurs de supabase-store.js, eux, lisent et
 * rendent `dossierNumber`, `commune` et `serviceInstructeur`. taskToRow()
 * ne trouve donc rien et envoie null ; rowToTask() remplit des champs que
 * personne ne lit. Les colonnes existent pourtant en base depuis la
 * migration 001 (dossier_number, commune, service_instructeur).
 *
 * MESURÉ sur origin/main 60976fb, application entière avec un faux Supabase
 * à mémoire dont la table tasks n'accepte que les colonnes des migrations :
 * la ligne envoyée compte 29 colonnes, dont ces trois à null. Tant que la
 * page reste ouverte, rien ne se voit — la fiche relit l'objet en mémoire.
 * Après un rechargement, les trois champs sont vides.
 *
 * Pour un planificateur, c'est la référence du dossier en mairie qui
 * disparaît, sans message, au prochain rechargement.
 *
 * DÉROULÉ. Le permis est créé par la fiche, avec les trois champs. La
 * fiche est rouverte une première fois avant rechargement, puis la page
 * est rechargée et la fiche rouverte : les trois valeurs doivent y être.
 *
 * LA FICHE EST OUVERTE PAR LA COLONNE DE GAUCHE (cellule .task-info de la
 * ligne), non par la barre : la colonne ne dépend ni du niveau de zoom
 * relu des réglages du compte partagé, ni de la largeur de la barre. La
 * vue, elle, est épinglée sur le planning après rechargement.
 *
 * HORS DE CE TEST : les dates de demande et de réponse aux pièces
 * complémentaires et la date de début d'affichage, saisies dans la même
 * section, sont perdues elles aussi au rechargement, mais pour une autre
 * raison : aucune colonne ne les reçoit. Leur correction exige une
 * migration ; elle fera l'objet d'une branche à part. */

/* Valeurs distinctes deux à deux : un mappeur qui intervertirait commune
   et service, ou relirait le même champ trois fois, ne passerait pas. Les
   accents vérifient que le texte fait l'aller-retour tel quel. */
const DOSSIER_PREFIXE = 'PC 069 266 26 X';
const COMMUNE = 'Villeurbanne';
const SERVICE = 'DDT du Rhône — urbanisme';
const DEPOT = '2026-03-02';

/** Un champ de la section permis, repéré par son libellé exact : les
 *  <label> de cette section ne sont pas associés à leur champ. */
function champPermis(page, libelle) {
    return page.locator('#taskModalOverlay .permit-fields .form-group')
        .filter({ has: page.locator('.form-label', { hasText: new RegExp(`^${libelle}$`) }) })
        .locator('input');
}

/** La cellule de gauche de la ligne du permis (nom et méta). */
function cellule(page, nom) {
    return page.locator('.gantt-row[data-task-id] .task-info').filter({ hasText: nom });
}

async function ouvrirFiche(page, nom) {
    await cellule(page, nom).dblclick();
    await expect(page.locator('#taskModalOverlay')).toBeVisible();
    await expect(page.locator('#taskModalTitle')).toContainText('Modifier');
}

async function fermerFicheSansEnregistrer(page) {
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

async function lireTroisChamps(page) {
    return {
        dossier: await champPermis(page, 'N° de dossier').inputValue(),
        commune: await champPermis(page, 'Commune').inputValue(),
        service: await champPermis(page, 'Service instructeur').inputValue(),
    };
}

test('le n° de dossier, la commune et le service instructeur d\'un permis survivent au rechargement', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E PermisChamps ${suffixe}`;
    const nomPermis = `PC Halle ${suffixe}`;
    const saisis = { dossier: `${DOSSIER_PREFIXE}${suffixe}`, commune: COMMUNE, service: SERVICE };

    await page.goto('index.html');
    await createProject(page, nomProjet);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();

    /* L'INSTRUMENT D'ABORD. Les trois champs doivent être trouvés par leur
       libellé, un et un seul chacun, avant toute saisie : un sélecteur qui
       ne résout pas doit échouer ici, en le disant, et non sur l'assertion
       centrale. */
    for (const libelle of ['N° de dossier', 'Commune', 'Service instructeur', 'Date de dépôt']) {
        await expect(champPermis(page, libelle), `champ « ${libelle} » de la fiche`).toHaveCount(1);
    }

    await page.locator('#taskName').fill(nomPermis);
    await page.locator('#taskStart').fill('2026-03-02');
    await page.locator('#taskEnd').fill('2026-03-13');
    await champPermis(page, 'N° de dossier').fill(saisis.dossier);
    await champPermis(page, 'Commune').fill(saisis.commune);
    await champPermis(page, 'Service instructeur').fill(saisis.service);
    await champPermis(page, 'Date de dépôt').fill(DEPOT);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(cellule(page, nomPermis)).toBeVisible({ timeout: 10_000 });

    /* DISCRIMINANT 1 — LA FICHE A PRIS LES TROIS VALEURS, ET SAIT LES RELIRE.
       Avant tout rechargement, la fiche rouverte les montre. Ferme deux
       mensonges : « la saisie n'a pas pris » (un vide relu plus bas
       viendrait alors de la saisie) et « la fiche ne relit jamais ces
       champs » (le défaut serait alors dans task-modal.js, pas dans
       l'enregistrement). Passe avant comme après le correctif. */
    await ouvrirFiche(page, nomPermis);
    expect(await lireTroisChamps(page), 'avant rechargement, la fiche relit les trois champs saisis')
        .toEqual(saisis);
    await fermerFicheSansEnregistrer(page);

    /* DISCRIMINANT 2 — LA LIGNE EST EN BASE AVANT LE RECHARGEMENT.
       L'envoi de addTask() est différé (setTimeout) et non attendu. On
       relit la base par le même module que l'application, jusqu'à y
       trouver la tâche. Ferme « le rechargement est parti avant
       l'écriture » : sans cela, un permis absent ou vide après
       rechargement pourrait venir d'une course, non du mappeur. Seule
       l'existence de la ligne est exigée ici. Passe avant comme après. */
    await expect.poll(() => page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const { supabaseStore } = await import(new URL('js/supabase-store.js', document.baseURI).href);
        const taches = await supabaseStore.getTasks(store.getActiveProject().id);
        return taches.some(t => t.name === nom && t.isPermit);
    }, nomPermis), { message: 'le permis est en base avant le rechargement', timeout: 15_000 }).toBe(true);

    await page.reload();
    await waitForAppReady(page);

    /* Rouvrir le projet par son nom : le projet actif relu des réglages
       pourrait être un autre projet du compte partagé. Puis épingler la vue
       planning, elle aussi relue des réglages. */
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nomProjet })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nomProjet);
    await page.locator('#tabTimeline').click();

    /* DISCRIMINANT 3 — LE PERMIS A SURVÉCU, AVEC CE QUI ÉTAIT DÉJÀ ENREGISTRÉ.
       Sa ligne est là, sa fiche s'ouvre sur son nom, en type permis, avec
       la date de dépôt saisie : un champ de la même section que deposit_date
       recevait déjà. Ferme « le rechargement a perdu toute la tâche » et
       « la fiche rouverte ne relit aucun champ de permis » : l'échec
       central ne pourra porter que sur les trois champs. Passe avant comme
       après. */
    await expect(cellule(page, nomPermis), 'le permis existe après rechargement').toBeVisible({ timeout: 10_000 });
    await ouvrirFiche(page, nomPermis);
    await expect(page.locator('#taskName')).toHaveValue(nomPermis);
    await expect(page.locator('.type-switcher-btn[data-type="permit"]')).toHaveClass(/active/);
    await expect(champPermis(page, 'Date de dépôt'), 'date de dépôt relue après rechargement').toHaveValue(DEPOT);

    /* --- L'ASSERTION CENTRALE ---
       Les trois valeurs saisies sont relues après rechargement. Sur main,
       les trois reviennent vides. */
    expect(await lireTroisChamps(page), 'après rechargement, la fiche relit les trois champs saisis')
        .toEqual(saisis);

    /* Fermer la fiche AVANT de nettoyer : laissée ouverte, son voile
       intercepte le clic sur le sélecteur de projet (voir
       permis-instruction-mois.spec.js). */
    await fermerFicheSansEnregistrer(page);
    await deleteActiveProject(page);
});
