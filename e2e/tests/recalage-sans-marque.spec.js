import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B7 (dépendances) et § B3 (jalon), sur ce que la
 * barre affiche APRÈS un recalage.
 *
 * LA DEMANDE : « quand je crée une activité ou un jalon et que je le lie à
 * un jalon/activité, j'ai toujours ce point d'exclamation pour me prévenir
 * d'un décalage, supprime cette fonctionnalité ».
 *
 * Ce point d'exclamation est la marque de recalage posée par #73 :
 * applyPredecessorConstraints() (store.js) émet `task:constrained` quand
 * les contraintes déplacent une tâche, et gantt-renderer.js pose alors sur
 * la barre un <span class="gantt-bar-recalage">!</span>, jusqu'au prochain
 * enregistrement de la tâche. Lier une tâche née plus loin que sa position
 * contrainte suffit à la faire paraître.
 *
 * CE QUI EST RETIRÉ : la marque. CE QUI RESTE : le recalage lui-même. La
 * tâche liée continue d'être placée par ses prédécesseurs ; seul le signal
 * sur la barre disparaît. Ce fichier remplace recalage-marque.spec.js, qui
 * exigeait la marque.
 *
 * LES DEUX TESTS reprennent les deux gestes cités :
 *   1. une activité liée à une activité, par sa fiche (le parcours de
 *      recalage-marque.spec.js) ;
 *   2. un jalon créé déjà lié à une activité, puis une activité créée déjà
 *      liée à ce jalon — le lien posé dès la fiche de création, qui passe
 *      par l'autre appel de applyPredecessorConstraints() (task-modal.js,
 *      branche « create »).
 *
 * L'ASSERTION CENTRALE relève, sur chaque barre, jalon et permis du Gantt,
 * tout ce qui ressemble à la marque, en deux moitiés :
 *   - PRÉSENCE DANS LE DOM : un élément .gantt-bar-recalage, ou un « ! »
 *     dans le texte de la barre, même masqué ;
 *   - VISIBILITÉ : un « ! » dans le texte RENDU de la barre (innerText), ou
 *     dans le contenu d'un pseudo-élément ::before / ::after.
 * La première moitié ferme le faux retrait par la feuille de style : une
 * marque toujours rendue mais masquée (display: none) passerait un test qui
 * ne regarderait que ce qui se voit. La seconde ferme le retrait qui ne
 * ferait que renommer la classe en gardant le glyphe. Le relevé nomme la
 * tâche en cause : l'échec dit sur quelle barre la marque est restée.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : deux échecs, chacun sur
 * l'assertion centrale. Dans le premier, la barre de l'activité liée porte
 * la marque ; dans le second, celle de l'activité liée au jalon. Le jalon,
 * lui, n'en porte pas : _renderMilestone() ne la dessine pas. Tous les
 * discriminants passent.
 *
 * JUIN 2026 COMMENCE UN LUNDI.
 */

const AMONT_DEBUT = '2026-06-01';   // lundi
const AMONT_FIN   = '2026-06-05';   // vendredi

/* Fin de l'amont + 1 = samedi 6, recalé au lundi 8. Chaque tâche liée NAÎT
   PLUS LOIN que sa position contrainte : sans cela le lien ne la
   déplacerait pas, et l'absence de marque ne prouverait rien. */
const LIEE_DEBUT   = '2026-06-11';  // jeudi
const LIEE_FIN     = '2026-06-12';  // vendredi — deux jours ouvrés
const RECALE_DEBUT = '2026-06-08';  // lundi
const RECALE_FIN   = '2026-06-09';  // mardi — les deux jours ouvrés gardés

const JALON_SAISI  = '2026-06-15';  // lundi
const JALON_RECALE = '2026-06-08';  // lundi : fin de l'amont + 1, recalée

/* Liée au jalon du 8 : 8 + 1 = mardi 9. Saisie mercredi 17 → jeudi 18,
   deux jours ouvrés, gardés : mardi 9 → mercredi 10. */
const APRES_JALON_SAISI_DEBUT  = '2026-06-17';
const APRES_JALON_SAISI_FIN    = '2026-06-18';
const APRES_JALON_RECALE_DEBUT = '2026-06-09';
const APRES_JALON_RECALE_FIN   = '2026-06-10';

/** Toute action est précédée d'une assertion de présence qui dit ce qui
 *  manque : un sélecteur qui ne résout plus doit échouer ici, sous son nom,
 *  et non expirer dans l'action ou passer pour un rouge. */
async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const fiche = (page) => page.locator('#taskModalOverlay');

async function fermee(page) {
    await expect(fiche(page)).toBeHidden({ timeout: 15_000 });
}

/** Coche `nomAmont` dans la liste « Précédée par » de la fiche ouverte. */
async function cocherPredecesseur(page, nomAmont) {
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const caseAmont = groupe.locator('.dep-list > div').filter({ hasText: nomAmont })
        .locator('input[type="checkbox"]');
    await present(caseAmont, `« ${nomAmont} » dans la liste « Précédée par »`);
    await caseAmont.check();
}

/** Ouvre la fiche de création, choisit le type, saisit nom et dates, coche
 *  les prédécesseurs, crée. Les dates sont celles SAISIES, avant tout
 *  recalage. */
async function creer(page, { nom, debut, fin, type = 'task', predecesseurs = [] }) {
    await (await present(page.locator('#addTaskBtn'), 'bouton d\'ajout de tâche')).click();
    await expect(fiche(page)).toBeVisible();
    if (type !== 'task') {
        await (await present(page.locator(`.type-switcher-btn[data-type="${type}"]`),
            `bouton de type « ${type} »`)).click();
    }
    await (await present(page.locator('#taskName'), 'champ du nom')).fill(nom);
    await (await present(page.locator('#taskStart'), 'champ de début')).fill(debut);
    if (fin) await (await present(page.locator('#taskEnd'), 'champ de fin')).fill(fin);
    for (const amont of predecesseurs) await cocherPredecesseur(page, amont);
    await (await present(page.getByRole('button', { name: 'Créer' }), 'bouton « Créer »')).click();
    await fermee(page);
}

const barreDe = (page, nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
/* Un jalon n'a pas de texte visible : il répond à son nom accessible. */
const jalonDe = (page, nom) => page.getByRole('button', { name: new RegExp(nom) });

/** Rouvre une tâche, lit ses dates, referme SANS enregistrer. */
async function lireDates(page, element, quoi) {
    await (await present(element, quoi)).dblclick();
    await expect(fiche(page)).toBeVisible();
    const dates = {
        debut: await page.locator('#taskStart').inputValue(),
        fin:   await page.locator('#taskEnd').inputValue(),
    };
    await (await present(fiche(page).locator('button.btn-secondary', { hasText: 'Annuler' }),
        'bouton « Annuler » de la fiche')).click();
    await fermee(page);
    return dates;
}

/** Relève, sous `racine`, tout ce qui ressemble à la marque retirée, sur
 *  chaque barre, jalon et permis. Chaque constat nomme l'élément en cause.
 *  Avec `sonde`, le relevé porte sur des barres factices construites dans
 *  la page et retirées dans le même appel, sans attente : voir le
 *  discriminant de l'instrument. */
async function releverMarques(page, { sonde = false } = {}) {
    return page.evaluate(({ sonde }) => {
        const releve = (racine) => {
            const constats = [];
            const nomDe = (el) => (el.querySelector('.gantt-bar-label')?.textContent
                || el.getAttribute('aria-label') || el.dataset.taskId || '?').trim();
            racine.querySelectorAll('.gantt-bar, .gantt-milestone, .gantt-permit').forEach((el) => {
                const nom = nomDe(el);
                // Présence dans le DOM, visible ou non.
                if (el.querySelector('.gantt-bar-recalage')) constats.push(`${nom} : élément .gantt-bar-recalage`);
                if (el.textContent.includes('!')) constats.push(`${nom} : « ! » dans le DOM`);
                // Visibilité : texte rendu, puis pseudo-éléments.
                if (el.innerText.includes('!')) constats.push(`${nom} : « ! » visible`);
                for (const n of [el, ...el.querySelectorAll('*')]) {
                    for (const pseudo of ['::before', '::after']) {
                        if (getComputedStyle(n, pseudo).content.includes('!')) {
                            constats.push(`${nom} : « ! » en ${pseudo}`);
                        }
                    }
                }
            });
            // Une marque détachée de toute barre compte aussi.
            const isolees = [...document.querySelectorAll('.gantt-bar-recalage')]
                .filter(m => !m.closest('.gantt-bar, .gantt-milestone, .gantt-permit')).length;
            if (isolees) constats.push(`${isolees} élément(s) .gantt-bar-recalage hors barre`);
            return constats;
        };
        if (!sonde) return releve(document.getElementById('ganttContainer'));

        const style = document.createElement('style');
        style.textContent = '.sonde-pseudo-recalage::after { content: "!"; }';
        const boite = document.createElement('div');
        boite.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px';
        boite.innerHTML =
            '<div class="gantt-bar"><span class="gantt-bar-label">sonde-masquee</span>'
            + '<span class="gantt-bar-recalage" style="display:none">!</span></div>'
            + '<div class="gantt-bar"><span class="gantt-bar-label">sonde-renommee</span>'
            + '<span class="autre-classe">!</span></div>'
            + '<div class="gantt-bar sonde-pseudo-recalage"><span class="gantt-bar-label">sonde-pseudo</span></div>'
            + '<div class="gantt-bar"><span class="gantt-bar-label">sonde-nette</span></div>';
        document.head.appendChild(style);
        document.body.appendChild(boite);
        try {
            return releve(boite);
        } finally {
            boite.remove();
            style.remove();
        }
    }, { sonde });
}

/** Ce que tout test de ce fichier vérifie avant de lier quoi que ce soit. */
async function monter(page, nomProjet) {
    await page.goto('index.html');
    await createProject(page, nomProjet);

    /* DISCRIMINANT — ON REGARDE BIEN LE GANTT. La vue active est relue des
       réglages du compte partagé ; on ne la change pas (ce serait écrire
       un réglage commun), on vérifie qu'elle est celle qu'on croit. Sinon
       aucune barre ne serait rendue, et « aucune marque » serait vrai sur
       un Gantt absent. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#ganttContainer')).toBeVisible();

    /* DISCRIMINANT — LE ZOOM EST CELUI QU'ON CROIT. Il est relu des
       réglages du compte, donc héritable d'un autre test : on le pose, et
       on vérifie qu'il a pris, pour que « la barre est rendue et visible »
       se mesure dans un montage connu. */
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);

    /* DISCRIMINANT — L'INSTRUMENT VOIT UNE MARQUE. Le relevé de l'assertion
       centrale est appliqué à quatre barres factices : une marque masquée
       par la feuille de style, un « ! » sous une autre classe, un « ! » en
       pseudo-élément, et une barre nette. Il doit trouver les trois
       premières, chacune par la moitié qui la concerne, et rien sur la
       quatrième. Sans cela, un relevé devenu aveugle — sélecteur faux,
       racine vide — donnerait « aucune marque » partout, avant comme après
       le correctif, et le vert ne mesurerait rien. Passe avant comme après :
       il ne dépend pas du code de l'application. */
    expect(await releverMarques(page, { sonde: true }),
        'le relevé ne voit pas une marque qu\'on lui présente').toEqual([
        'sonde-masquee : élément .gantt-bar-recalage',
        'sonde-masquee : « ! » dans le DOM',
        'sonde-renommee : « ! » dans le DOM',
        'sonde-renommee : « ! » visible',
        'sonde-pseudo : « ! » en ::after',
    ]);
}

/** L'assertion centrale, commune aux deux tests. */
async function aucuneMarque(page) {
    await expect.poll(() => releverMarques(page), {
        message: 'une barre porte encore la marque de recalage (présente dans le DOM ou visible)',
        timeout: 5_000,
    }).toEqual([]);
}

test('une activité déplacée par le lien à une activité ne porte aucune marque', async ({ page }) => {
    const suffixe  = Date.now();
    const nomAmont = `Fondations ${suffixe}`;
    const nomLiee  = `Élévation ${suffixe}`;

    await monter(page, `E2E RecalageSansMarque ${suffixe}`);

    await creer(page, { nom: nomAmont, debut: AMONT_DEBUT, fin: AMONT_FIN });
    await creer(page, { nom: nomLiee, debut: LIEE_DEBUT, fin: LIEE_FIN });

    // Lier par la fiche, en Fin→Début : l'enregistrement de ce lien déclenche
    // applyPredecessorConstraints(), donc le déplacement.
    await (await present(barreDe(page, nomLiee), `barre de « ${nomLiee} »`)).dblclick();
    await expect(fiche(page)).toBeVisible();
    await cocherPredecesseur(page, nomAmont);
    await (await present(fiche(page).getByRole('button', { name: 'Enregistrer' }),
        'bouton « Enregistrer » de la fiche')).click();
    await fermee(page);

    /* DISCRIMINANT — LA TÂCHE A RÉELLEMENT ÉTÉ DÉPLACÉE. Son début suit la
       fin de l'amont selon le calendrier ouvré (samedi 6 → lundi 8), et elle
       garde ses deux jours. Ferme « rien n'a bougé, donc pas de marque de
       toute façon » : sans déplacement, l'ancienne application ne posait
       pas de marque non plus. On referme sans enregistrer. */
    expect(await lireDates(page, barreDe(page, nomLiee), `barre de « ${nomLiee} »`),
        'la tâche liée n\'a pas été recalée sur son prédécesseur')
        .toEqual({ debut: RECALE_DEBUT, fin: RECALE_FIN });

    /* DISCRIMINANT — LA BARRE EST RENDUE ET VISIBLE. Ferme « on regarde une
       barre absente » : une barre non rendue ne porterait aucune marque. */
    await expect(barreDe(page, nomLiee), 'barre de la tâche liée').toBeVisible();
    await expect(barreDe(page, nomAmont), 'barre du prédécesseur').toBeVisible();

    // --- L'ASSERTION CENTRALE ---
    await aucuneMarque(page);

    await deleteActiveProject(page);
});

test('un jalon lié, et une activité liée à ce jalon, ne portent aucune marque', async ({ page }) => {
    const suffixe   = Date.now();
    const nomAmont  = `Terrassement ${suffixe}`;
    const nomJalon  = `Réception fonds de fouille ${suffixe}`;
    const nomApres  = `Coulage semelles ${suffixe}`;

    await monter(page, `E2E RecalageSansMarqueJalon ${suffixe}`);

    await creer(page, { nom: nomAmont, debut: AMONT_DEBUT, fin: AMONT_FIN });
    // Un jalon créé DÉJÀ lié à l'activité : le lien est posé dès la création.
    await creer(page, { nom: nomJalon, debut: JALON_SAISI, type: 'milestone', predecesseurs: [nomAmont] });
    // Une activité créée DÉJÀ liée au jalon.
    await creer(page, { nom: nomApres, debut: APRES_JALON_SAISI_DEBUT, fin: APRES_JALON_SAISI_FIN,
        predecesseurs: [nomJalon] });

    /* DISCRIMINANT — LES DEUX ONT RÉELLEMENT ÉTÉ DÉPLACÉS. Le jalon saisi
       au 15 suit la fin de l'activité (lundi 8) ; l'activité saisie au 17
       suit le jalon (mardi 9) en gardant ses deux jours. Ferme « rien n'a
       bougé » pour chacun des deux gestes. */
    expect(await lireDates(page, jalonDe(page, nomJalon), `jalon « ${nomJalon} »`),
        'le jalon n\'a pas été recalé sur son prédécesseur')
        .toEqual({ debut: JALON_RECALE, fin: JALON_RECALE });
    expect(await lireDates(page, barreDe(page, nomApres), `barre de « ${nomApres} »`),
        'l\'activité liée au jalon n\'a pas été recalée sur lui')
        .toEqual({ debut: APRES_JALON_RECALE_DEBUT, fin: APRES_JALON_RECALE_FIN });

    /* DISCRIMINANT — LE JALON ET LA BARRE SONT RENDUS ET VISIBLES. */
    await expect(jalonDe(page, nomJalon), 'losange du jalon').toBeVisible();
    await expect(jalonDe(page, nomJalon)).toHaveClass(/gantt-milestone/);
    await expect(barreDe(page, nomApres), 'barre de l\'activité liée au jalon').toBeVisible();

    // --- L'ASSERTION CENTRALE ---
    await aucuneMarque(page);

    await deleteActiveProject(page);
});
