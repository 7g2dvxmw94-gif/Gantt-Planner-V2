import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G3, volet 4 — « Ouvrir le PDF : Gantt visible et
 * lisible ». L'export PDF n'avait aucun test : c'est la seule sortie du
 * produit que rien ne vérifiait.
 *
 * LE DÉFAUT : _exportPDF() construit son document en concaténant des
 * chaînes HTML et y interpole les noms de tâches SANS LES ÉCHAPPER.
 *
 *     html += `<tr class="phase-row"><td colspan="7">${task.name} …`
 *     rowHtml += `<div class="gantt-tl-label…">${task.name}</div>`
 *
 * Un nom contenant des chevrons est alors relu comme du balisage par
 * l'analyseur HTML : « Réunion <MOA> & MOE » perd son <MOA>, pris pour une
 * balise inconnue et supprimée. Le document exporté ne montre plus le nom
 * que l'utilisateur a saisi.
 *
 * escapeHtml() EXISTE et est importée dans app.js, où elle sert cinq fois
 * ailleurs. _exportPDF() est la seule fonction du fichier à ne pas s'en
 * servir — même forme d'oubli que le calcul de coûts en #46.
 *
 * CE N'EST PAS QU'UN PROBLÈME D'AFFICHAGE. Le document est écrit par
 * document.write() dans une fenêtre de MÊME ORIGINE, et les projets se
 * partagent entre comptes (project_members, invitations). Un nom de tâche
 * choisi par un collaborateur devient donc du balisage exécuté chez qui
 * exporte. Le test se garde d'écrire une charge active : il suffit de
 * montrer que le nom n'arrive pas intact pour établir le défaut, et le
 * correctif — échapper — traite les deux conséquences d'un coup.
 *
 * LE NOM EST INTACT DANS L'APPLICATION : le rendu Gantt passe par
 * createElement(), qui écrit du texte. C'est asserté avant l'export, pour
 * que la mutilation soit imputée à l'export et non à la saisie.
 */

/* Chevrons, esperluette, et des sigles du métier — MOA et MOE désignent
   maîtrise d'ouvrage et maîtrise d'œuvre. Avec le défaut, « <MOA> » est
   avalé et il reste « Réunion  & MOE … ». */
const nomAvecBalisage = (s) => `Réunion <MOA> & MOE ${s}`;

test('l\'export PDF ne mutile pas un nom de tâche contenant des chevrons', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E ExportPDF ${suffixe}`;
    const nomTache  = nomAvecBalisage(suffixe);
    const nomTemoin = `Visite chantier ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Deux tâches : celle qui porte le balisage, et un témoin sobre ---
    for (const [nom, debut, fin] of [[nomTache, '2026-09-07', '2026-09-09'],
                                     [nomTemoin, '2026-09-10', '2026-09-11']]) {
        await page.locator('#addTaskBtn').click();
        const modale = page.locator('#taskModalOverlay');
        await modale.locator('#taskName').fill(nom);
        await modale.locator('#taskStart').fill(debut);
        await modale.locator('#taskEnd').fill(fin);
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(modale).toBeHidden({ timeout: 15_000 });
    }

    /* PREMIER DISCRIMINANT — le nom est INTACT dans l'application. Le
       rendu Gantt écrit du texte, pas du balisage : la barre porte le nom
       complet, chevrons compris. Sans cette vérification, un nom mutilé
       dans le PDF pourrait venir de la saisie ou du stockage, et le rouge
       n'imputerait rien à l'export. */
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    // --- Exporter en PDF ---
    await page.locator('#exportBtn').click();
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^PDF$/ }) })
        .click();

    const dialogue = page.locator('#pdfExportDialog');
    await expect(dialogue).toBeVisible({ timeout: 10_000 });

    /* Le document part dans une fenêtre ouverte par window.open() : c'est
       elle qu'il faut capturer, le contenu n'existe nulle part ailleurs. */
    const fenetrePromise = page.waitForEvent('popup');
    await dialogue.locator('.pdf-export-confirm').click();
    const fenetre = await fenetrePromise;

    const corps = fenetre.locator('body');

    /* DEUXIÈME DISCRIMINANT — le document est bien celui du projet. */
    await expect(corps).toContainText(nomProjet, { timeout: 15_000 });

    /* TROISIÈME DISCRIMINANT — le tableau des tâches a bien été produit,
       preuve par le témoin, dont le nom ne contient rien de spécial. Une
       absence signifierait que la section n'a pas été rendue, et le nom
       manquant plus bas ne prouverait rien. */
    await expect(corps).toContainText(nomTemoin);

    /* --- L'ASSERTION CENTRALE ---
       Le nom doit figurer en entier. Faute d'échappement, « <MOA> » est
       relu comme une balise inconnue et disparaît du document. */
    await expect(corps).toContainText(nomTache);

    await fenetre.close();
    await deleteActiveProject(page);
});
