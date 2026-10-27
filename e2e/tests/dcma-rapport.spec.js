import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique) et § AC1 (clavier), sous
 * l'angle du rapport DCMA 14 points : le bouton de la barre d'outils ouvre
 * une fenêtre qui évalue le projet ACTIF.
 *
 * dcma-calcul.spec.js mesure le calcul point par point. Ce test-ci mesure
 * le BRANCHEMENT : le planning est construit dans l'interface — tâches et
 * liens saisis dans la modale —, et le rapport doit le lire tel que le
 * store le tient, avec la vraie marge et le vrai placement.
 *
 * TROIS TÂCHES, DEUX LIENS. A ; B après A en Fin→Début avec une AVANCE de
 * deux jours ; C après B. Comptés à la main, puis mesurés avec le texte
 * réel du moteur hors navigateur :
 *   1 logique     A sans prédécesseur, C sans successeur   → 66,7 % (2/3)
 *   2 avances     le lien B←A                               → 50 % (1/2)
 *   4 Fin→Début   les deux liens                            → 100 % (2/2)
 *   5             le modèle n'a pas de contraintes de date  → sans objet
 *   7             aucune échéance de projet                 → non mesurable
 *  12 test        A, B, C critiques ; retarder A de 600 jours ouvrés
 *                 fait reculer C d'autant                   → conforme
 *
 * LE NOM DU PROJET PORTE DES CHEVRONS (« <MOA> & Cie »), sans charge
 * active : le rapport l'affiche par escapeHtml, et il doit arriver intact.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur la première
 * assertion centrale — « bouton DCMA absent de la barre d'outils ». */

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

function lignePredecesseur(page, nomPredecesseur) {
    const groupe = page.locator('#taskModalOverlay .form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    return groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
}

async function lier(page, barreSuccesseur, nomPredecesseur, decalage) {
    await barreSuccesseur.dblclick();
    const ligne = lignePredecesseur(page, nomPredecesseur);
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption('FS');
    await ligne.locator('input[type="number"]').fill(String(decalage));
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

test('le bouton DCMA ouvre le rapport du projet actif', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E DCMA <MOA> & Cie ${suffixe}`;
    const nomA = `Terrassement ${suffixe}`;
    const nomB = `Fondations ${suffixe}`;
    const nomC = `Elevation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomA, '2026-06-01', '2026-06-05');
    const barreB = await creerTache(page, nomB, '2026-06-08', '2026-06-12');
    const barreC = await creerTache(page, nomC, '2026-06-15', '2026-06-16');
    await lier(page, barreB, nomA, -2);
    await lier(page, barreC, nomB, 0);

    /* DISCRIMINANT 1 — L'AVANCE A BIEN ÉTÉ SAISIE. Rouvrir B et relire son
       lien vers A. Sans ce point, un « 0 % » d'avances pourrait venir de la
       saisie et non du rapport. Passe avant comme après. */
    await barreB.dblclick();
    const lienBA = lignePredecesseur(page, nomA);
    await expect(lienBA.locator('input[type="checkbox"]')).toBeChecked();
    await expect(lienBA.locator('input[type="number"]')).toHaveValue('-2');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* DISCRIMINANT 2 — L'INTERFACE EST EN FRANÇAIS. Les valeurs se lisent au
       format français (« 66,7 % ») : en anglais, elles différeraient sans
       rien dire du rapport. Passe avant comme après. */
    await expect(page.locator('[data-i18n="toolbar.criticalPath"]')).toHaveText('Chemin critique');

    /* --- L'ASSERTION CENTRALE ---
       Le bouton existe, il ouvre une fenêtre modale qui prend le focus, et
       cette fenêtre évalue le projet actif tel que l'interface l'a construit. */
    const bouton = page.locator('#dcmaBtn');
    await expect(bouton, 'bouton DCMA absent de la barre d\'outils').toBeVisible();
    await bouton.click();

    const modale = page.locator('#dcmaReportModal');
    await expect(modale.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
    await expect(modale.locator('.dcma-close'), 'le focus entre dans la fenêtre').toBeFocused();
    await expect(modale.locator('.dcma-projet'), 'nom du projet, chevrons compris').toHaveText(nomProjet);
    await expect(modale.locator('.dcma-perimetre')).toHaveText('3 tâche(s) incomplète(s), 2 lien(s)');

    const ligne = (n) => modale.locator(`tr[data-dcma-point="${n}"]`);
    await expect(ligne(1).locator('.dcma-valeur')).toHaveText('66,7 % (2/3)');
    await expect(ligne(1)).toHaveAttribute('data-etat', 'alerte');
    await expect(ligne(2).locator('.dcma-valeur')).toHaveText('50 % (1/2)');
    await expect(ligne(2)).toHaveAttribute('data-etat', 'alerte');
    await expect(ligne(4).locator('.dcma-valeur')).toHaveText('100 % (2/2)');
    await expect(ligne(4)).toHaveAttribute('data-etat', 'ok');
    await expect(ligne(5)).toHaveAttribute('data-etat', 'sans-objet');
    await expect(ligne(7)).toHaveAttribute('data-etat', 'na');
    /* Le test du chemin critique passe par le placement du store : le voir
       conforme établit que le rapport a bien reçu le vrai moteur. */
    await expect(ligne(12)).toHaveAttribute('data-etat', 'ok');
    await expect(ligne(12).locator('.dcma-valeur')).toHaveText('fin reculée de 600 j ouvrés pour 600 j de retard');

    /* Échap ferme, et rend le focus au bouton qui avait ouvert. */
    await page.keyboard.press('Escape');
    await expect(modale).toHaveCount(0);
    await expect(bouton).toBeFocused();

    await deleteActiveProject(page);
});
