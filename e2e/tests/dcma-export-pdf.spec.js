import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G3 (export PDF), pour le rapport DCMA 14 points :
 * le dialogue d'export propose une section « Robustesse du planning
 * (DCMA 14) », et le document imprimé la contient.
 *
 * DÉCOCHÉE PAR DÉFAUT : les exports PDF existants ne changent pas. ABSENTE
 * DE L'EXPORT POWERPOINT, qui partage le même dialogue mais ne sait pas
 * la produire — la proposer y serait une case sans effet.
 *
 * UNE CHAÎNE DE TROIS TÂCHES, A → B → C : au point 1 (logique), A n'a pas
 * de prédécesseur et C pas de successeur → 66,7 % (2/3), la valeur que
 * la fenêtre du rapport affiche aussi. Fenêtre et PDF partagent la même
 * mise en forme (_dcmaPresentation).
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur la première
 * assertion centrale — « option DCMA absente du dialogue d'export PDF ». */

/** Juin 2026 commence un lundi. */
async function creerTache(page, nom, debut, fin) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

async function lier(page, barreSuccesseur, nomPredecesseur) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('#taskModalOverlay .form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const ligne = groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption('FS');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

async function ouvrirDialogue(page, format) {
    await page.locator('#exportBtn').click();
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: new RegExp(`^${format}$`) }) })
        .click();
    const dialogue = page.locator('#pdfExportDialog');
    await expect(dialogue).toBeVisible({ timeout: 10_000 });
    return dialogue;
}

test('l\'export PDF peut inclure le rapport DCMA', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E DCMAPdf ${suffixe}`;
    const nomA = `Terrassement ${suffixe}`;
    const nomB = `Fondations ${suffixe}`;
    const nomC = `Elevation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomA, '2026-06-01', '2026-06-05');
    const barreB = await creerTache(page, nomB, '2026-06-08', '2026-06-12');
    const barreC = await creerTache(page, nomC, '2026-06-15', '2026-06-19');
    await lier(page, barreB, nomA);
    await lier(page, barreC, nomB);

    const dialogue = await ouvrirDialogue(page, 'PDF');

    /* DISCRIMINANT 1 — C'EST BIEN LE DIALOGUE D'EXPORT PDF, avec ses
       sections habituelles. Passe avant comme après. */
    await expect(dialogue.locator('input[value="table"]')).toBeChecked();

    // --- L'ASSERTION CENTRALE, 1/2 : l'option existe, décochée par défaut.
    const option = dialogue.locator('input[value="dcma"]');
    await expect(option, 'option DCMA absente du dialogue d\'export PDF').toHaveCount(1);
    await expect(option, 'décochée par défaut : les exports existants ne changent pas').not.toBeChecked();
    await option.check();

    /* Le document part dans une fenêtre ouverte par window.open(). */
    const fenetrePromise = page.waitForEvent('popup');
    await dialogue.locator('.pdf-export-confirm').click();
    const fenetre = await fenetrePromise;
    const corps = fenetre.locator('body');

    /* DISCRIMINANT 2 — LE DOCUMENT EST CELUI DU PROJET, et sa section
       Tableau a bien été produite. Passe avant comme après. */
    await expect(corps).toContainText(nomProjet, { timeout: 15_000 });
    await expect(corps).toContainText(nomB);

    // --- L'ASSERTION CENTRALE, 2/2 : la section DCMA est dans le document.
    await expect(corps.locator('h2.dcma-pdf')).toHaveText('Robustesse du planning — DCMA 14 points');
    await expect(corps.locator('tr[data-dcma-point]')).toHaveCount(14);
    await expect(corps.locator('tr[data-dcma-point="1"]')).toContainText('66,7 % (2/3)');
    await fenetre.close();

    /* L'export PowerPoint partage le dialogue mais ne produit pas cette
       section : il ne la propose pas. */
    const dialoguePpt = await ouvrirDialogue(page, 'PPT');
    await expect(dialoguePpt.locator('input[value="dcma"]')).toHaveCount(0);
    await dialoguePpt.locator('.pdf-export-cancel').click();

    await deleteActiveProject(page);
});
