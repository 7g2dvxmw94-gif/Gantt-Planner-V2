import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B10 (sélection multiple), depuis le rapport DCMA
 * 14 points : une ligne en alerte doit mener aux tâches qui la causent.
 *
 * Un pourcentage ne dit pas QUELLES tâches sont en cause. Le module les
 * connaît — chaque point porte ses « fautives » — ; un bouton
 * « Sélectionner (n) » dans la ligne ferme la fenêtre et les sélectionne
 * dans le Gantt, avec la barre d'actions habituelle.
 *
 * UNE CHAÎNE DE TROIS TÂCHES, A → B → C : au point 1 (logique), A n'a pas
 * de prédécesseur et C pas de successeur. B, reliée des deux côtés, ne doit
 * PAS être sélectionnée — c'est elle qui distingue « les fautives » de
 * « toutes les tâches ».
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur la première
 * assertion centrale — « bouton « Sélectionner » absent de la ligne 1 ». */

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

test('le rapport DCMA sélectionne les tâches en cause d\'un point en alerte', async ({ page }) => {
    const suffixe = Date.now();
    const nomA = `Terrassement ${suffixe}`;
    const nomB = `Fondations ${suffixe}`;
    const nomC = `Elevation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, `E2E DCMASel ${suffixe}`);
    const barreA = await creerTache(page, nomA, '2026-06-01', '2026-06-05');
    const barreB = await creerTache(page, nomB, '2026-06-08', '2026-06-12');
    const barreC = await creerTache(page, nomC, '2026-06-15', '2026-06-19');
    await lier(page, barreB, nomA);
    await lier(page, barreC, nomB);

    /* DISCRIMINANT 1 — RIEN N'EST SÉLECTIONNÉ AU DÉPART. Le double-clic qui
       ouvre une tâche la sélectionne aussi : sans ce nettoyage, une tâche
       restée sélectionnée depuis la saisie des liens passerait pour une
       sélection du rapport. Échap vide la sélection. Passe avant comme
       après. */
    await page.keyboard.press('Escape');
    await expect(page.locator('.gantt-bar.selected')).toHaveCount(0);

    await page.locator('#dcmaBtn').click();
    const modale = page.locator('#dcmaReportModal');
    const ligne1 = modale.locator('tr[data-dcma-point="1"]');

    /* DISCRIMINANT 2 — LE POINT 1 EST EN ALERTE SUR DEUX TÂCHES SUR TROIS :
       la sélection attendue est bien {A, C}. Passe avant comme après. */
    await expect(ligne1.locator('.dcma-valeur')).toHaveText('66,7 % (2/3)');

    // --- L'ASSERTION CENTRALE ---
    const bouton = ligne1.locator('[data-dcma-selection="1"]');
    await expect(bouton, 'bouton « Sélectionner » absent de la ligne 1').toBeVisible();
    await expect(bouton).toHaveText('Sélectionner (2)');
    await bouton.click();

    await expect(modale, 'la fenêtre se ferme').toHaveCount(0);
    await expect(barreA).toHaveClass(/\bselected\b/);
    await expect(barreC).toHaveClass(/\bselected\b/);
    await expect(barreB, 'B, reliée des deux côtés, n\'est pas en cause').not.toHaveClass(/\bselected\b/);
    await expect(page.locator('#batchActionBar .batch-count')).toHaveText('2 tâches sélectionnées');

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);
});
