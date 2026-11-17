import { test, expect } from '../fixtures.js';
import { waitForAppReady, deleteActiveProject } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B12 : la fiche d'une tâche saisit son Début réel et
 * sa Fin réelle, à la manière de MS Project.
 *
 * LE BESOIN. Depuis R0 (#157), une tâche garde ses dates réelles en base,
 * mais AUCUNE INTERFACE NE LES POSE : seul un fichier importé en porte. La
 * fiche n'a ni « Début réel » ni « Fin réelle ».
 *
 * CE QUE LA FICHE DOIT FAIRE (décisions de l'utilisateur, plan des dates
 * réelles) :
 *   1. une Fin réelle saisie seule : le Début réel prend le début prévu,
 *      la tâche passe à 100 % et « Terminé » AVANT même l'enregistrement ;
 *      enregistrée, relue à la réouverture et après rechargement ;
 *   2. un Début réel seul : « En cours », à 0 % ; LE PRÉVU SUIT LE RÉEL :
 *      la tâche commence au Début réel, à durée ouvrée conservée ;
 *   3. une Fin réelle antérieure au Début réel est refusée : la fiche reste
 *      ouverte, le champ en erreur, un message en alerte, rien d'écrit.
 *
 * LE JEU, importé par le bouton « Importer », sans aucun lien (l'ancrage
 * des tâches commencées dans le moteur est la marche suivante, R2) :
 *   A  lundi 08 → vendredi 12/06/2026 (5 jours ouvrés) ;
 *   B  lundi 15 → vendredi 19/06/2026 (5 jours ouvrés).
 * JUIN 2026 COMMENCE UN LUNDI et n'a aucun férié.
 *
 * LE COMPTE EST PARTAGÉ : chaque test importe son projet, au nom suffixé,
 * confié au filet de nettoyage, et lit les tâches par NOM.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 3 failed, chacun sur la première
 * assertion centrale, « champ « Fin réelle » absent de la fiche ». Les
 * discriminants qui la précèdent passent. */

const FICHE = '#taskModalOverlay';
const fiche = (page) => page.locator(FICHE);

function jeu(suffixe) {
    const tache = (id, nom, startDate, endDate, ordre) => ({
        id, name: `${nom} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [],
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesFiche ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Coulage', '2026-06-08', '2026-06-12', 0),
            tache('jeu-b', 'B Décoffrage', '2026-06-15', '2026-06-19', 1),
        ],
        resources: [],
    };
}

/* Ce que les attendus supposent du calendrier : lundi-vendredi, aucun férié
   du 08 au 23 juin. */
const CALENDRIER_SUPPOSE = {
    '2026-06-08': true, '2026-06-12': true, '2026-06-13': false, '2026-06-14': false,
    '2026-06-15': true, '2026-06-17': true, '2026-06-19': true, '2026-06-20': false,
    '2026-06-21': false, '2026-06-22': true, '2026-06-23': true,
};

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** « début→fin réel début→fin avancement% statut », lu dans le store VIVANT,
 *  par nom (le compte est partagé). */
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
                const x = t[0];
                return [n, `${x.startDate}→${x.endDate} réel ${x.actualStart ?? '—'}→${x.actualFinish ?? '—'} ${x.progress}% ${x.status}`];
            })),
        };
    }, noms);
}

async function ouvrirFiche(page, nom) {
    const cellule = await present(page.locator(`.gantt-row .task-name[title="${nom}"]`), `nom de « ${nom} » dans le Gantt`);
    await cellule.dblclick();
    await expect(fiche(page), `la fiche de « ${nom} » doit s'ouvrir`).toBeVisible({ timeout: 10_000 });
    /* DISCRIMINANT — C'EST BIEN LA FICHE DE CETTE TÂCHE. Ferme « on lit la
       fiche d'une autre tâche ». Passe avant comme après. */
    await expect(page.locator('#taskName'), 'la fiche ouverte doit être celle de la tâche visée').toHaveValue(nom);
}

async function enregistrer(page) {
    await (await present(fiche(page).locator('.modal-footer .btn-primary'), 'bouton « Enregistrer » de la fiche')).click();
}

async function fermerSansEnregistrer(page) {
    await (await present(fiche(page).locator('.modal-footer .btn-secondary'), 'bouton « Annuler » de la fiche')).click();
    await expect(fiche(page), 'la fiche doit se fermer').toBeHidden();
}

/** Les deux champs : l'assertion de présence de la Fin réelle est la
 *  PREMIÈRE de l'assertion centrale de chaque test. C'est elle qui échoue
 *  tant que la fiche n'a pas la ligne. */
async function champsReels(page) {
    const fin = page.locator('#taskActualFinish');
    await expect(fin, 'champ « Fin réelle » absent de la fiche').toBeVisible();
    const debut = page.locator('#taskActualStart');
    await expect(debut, 'champ « Début réel » absent de la fiche').toBeVisible();
    return { debut, fin };
}

async function verifierMontage(page, nomProjet) {
    /* DISCRIMINANT — ON REGARDE LE GANTT. La vue est héritée de l'état du
       compte partagé : posée puis relue. Ferme « la colonne des noms n'est
       pas là » : l'échec viendrait du montage, pas de la fiche. */
    const onglet = await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt');
    await onglet.click();
    await expect(onglet, 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT — LE CALENDRIER EST CELUI QU'ON CROIT, lu dans le store
       VIVANT. Ferme « un férié ou un samedi travaillé, posé par un autre
       test du compte partagé, déplace la fin attendue de B (23/06) ». */
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

async function preparer(page) {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dates-reelles-fiche.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await verifierMontage(page, nomProjet);

    /* DISCRIMINANT — LE SOCLE : A et B à leurs dates, sans réel, à faire.
       Ferme « l'import a déjà posé un réel ou déplacé une tâche » : tout ce
       qui suit vient de la fiche. Passe avant comme après. */
    const socle = await lire(page, [A, B]);
    expect(socle.taches, 'le socle importé').toEqual({
        [A]: '2026-06-08→2026-06-12 réel —→— 0% todo',
        [B]: '2026-06-15→2026-06-19 réel —→— 0% todo',
    });
    return { nomProjet, idProjet: socle.idProjet, A, B };
}

test('une Fin réelle saisie seule : Début réel au début prévu, 100 % et « Terminé », relue après rechargement', async ({ page }) => {
    const { nomProjet, idProjet, A, B } = await preparer(page);
    await ouvrirFiche(page, A);

    // --- L'ASSERTION CENTRALE ---
    const { debut, fin } = await champsReels(page);
    await expect(debut, 'à l\'ouverture, aucun Début réel').toHaveValue('');
    await expect(fin, 'à l\'ouverture, aucune Fin réelle').toHaveValue('');

    await fin.fill('2026-06-12');
    /* Avant même l'enregistrement, la fiche dit ce que la Fin réelle
       entraîne. */
    await expect(debut, 'sans Début réel, il prend le début prévu').toHaveValue('2026-06-08');
    await expect(page.locator('#taskProgress'), 'la Fin réelle passe l\'avancement à 100 %').toHaveValue('100');
    await expect(page.locator('#taskStatus'), 'la Fin réelle passe le statut à « Terminé »').toHaveValue('done');
    /* Le curseur ramené à 60 % après coup ne défait pas la Fin réelle : une
       tâche finie est à 100 % (décision de l'utilisateur). */
    await page.locator('#taskProgress').fill('60');
    await expect(page.locator('#taskProgress'), 'le curseur a pris 60 %').toHaveValue('60');

    await enregistrer(page);
    await expect(fiche(page), 'la fiche doit se fermer à l\'enregistrement').toBeHidden({ timeout: 15_000 });
    expect((await lire(page, [A, B])).taches, 'A finie, B intacte').toEqual({
        [A]: '2026-06-08→2026-06-12 réel 2026-06-08→2026-06-12 100% done',
        [B]: '2026-06-15→2026-06-19 réel —→— 0% todo',
    });

    await ouvrirFiche(page, A);
    await expect(debut, 'rouverte, la fiche relit le Début réel').toHaveValue('2026-06-08');
    await expect(fin, 'rouverte, la fiche relit la Fin réelle').toHaveValue('2026-06-12');
    await fermerSansEnregistrer(page);

    await page.reload();
    await waitForAppReady(page);
    /* DISCRIMINANT — LE PROJET ROUVERT EST CELUI DU TEST. Ferme « on relit
       un autre projet du compte partagé ». */
    expect((await lire(page, [])).idProjet, 'après rechargement, le projet actif doit être celui du test').toBe(idProjet);
    await verifierMontage(page, nomProjet);
    expect((await lire(page, [A])).taches[A], 'après rechargement, A relue de la base')
        .toBe('2026-06-08→2026-06-12 réel 2026-06-08→2026-06-12 100% done');
    await ouvrirFiche(page, A);
    /* Après rechargement, la fiche est neuve : ce qu'elle montre vient de
       la tâche, pas d'une saisie restée dans les champs. */
    await expect(page.locator('#taskActualStart'), 'après rechargement, la fiche relit le Début réel').toHaveValue('2026-06-08');
    await expect(page.locator('#taskActualFinish'), 'après rechargement, la fiche relit la Fin réelle').toHaveValue('2026-06-12');
    await fermerSansEnregistrer(page);

    await deleteActiveProject(page);
});

test('un Début réel seul : « En cours », et le prévu suit le réel à durée ouvrée conservée', async ({ page }) => {
    const { A, B } = await preparer(page);
    await ouvrirFiche(page, B);

    // --- L'ASSERTION CENTRALE ---
    const { debut, fin } = await champsReels(page);
    await debut.fill('2026-06-17');
    await expect(page.locator('#taskStatus'), 'un Début réel passe le statut à « En cours »').toHaveValue('in_progress');
    await expect(page.locator('#taskProgress'), 'l\'avancement reste à 0 %').toHaveValue('0');
    await expect(fin, 'aucune Fin réelle n\'est inventée').toHaveValue('');

    await enregistrer(page);
    await expect(fiche(page), 'la fiche doit se fermer à l\'enregistrement').toBeHidden({ timeout: 15_000 });
    /* Mercredi 17 + 5 jours ouvrés : 17, 18, 19, 22, 23 → mardi 23/06. */
    expect((await lire(page, [A, B])).taches, 'B commence au 17, finit le 23 ; A intacte').toEqual({
        [A]: '2026-06-08→2026-06-12 réel —→— 0% todo',
        [B]: '2026-06-17→2026-06-23 réel 2026-06-17→— 0% in_progress',
    });

    await deleteActiveProject(page);
});

test('une Fin réelle antérieure au Début réel est refusée, rien n\'est écrit', async ({ page }) => {
    const { A } = await preparer(page);
    await ouvrirFiche(page, A);

    // --- L'ASSERTION CENTRALE ---
    const { debut, fin } = await champsReels(page);
    await debut.fill('2026-06-10');
    await fin.fill('2026-06-09');
    /* DISCRIMINANT — LE CHAMP A GARDÉ LA SAISIE. Ferme « le Début réel a
       été réécrit par la Fin réelle » : le refus porte sur 09 < 10. */
    await expect(debut, 'le Début réel saisi est gardé').toHaveValue('2026-06-10');

    await enregistrer(page);
    /* La classe, pas la visibilité : une fiche qui se ferme reste visible
       le temps de sa transition (leçon de contraintes-fiche.spec.js). */
    await expect(fiche(page), 'une Fin réelle avant le Début réel ne doit pas fermer la fiche').toHaveClass(/\bactive\b/);
    await expect(fin, 'la Fin réelle doit être marquée en erreur').toHaveClass(/input-error/);
    await expect(fin).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#taskActualError'), 'le message doit être une alerte').toHaveAttribute('role', 'alert');
    await expect(page.locator('#taskActualError'), 'le message doit dire pourquoi').toContainText('précéder le début réel');
    expect((await lire(page, [A])).taches[A], 'rien ne doit être enregistré')
        .toBe('2026-06-08→2026-06-12 réel —→— 0% todo');

    await fermerSansEnregistrer(page);
    await deleteActiveProject(page);
});
