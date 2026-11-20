import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* La fiche de tâche est rangée en onglets, comme « Informations sur la
 * tâche » de MS Project.
 *
 * LE BESOIN (demande de l'utilisateur, 20/11/2026, maquette validée) : la
 * fiche empilait une quinzaine de blocs. Rangée par thème :
 *   en-tête, toujours visible : nom et — à la CRÉATION seulement — type ;
 *   Général (phase, priorité, dates prévues, durée, couleur), Avancement
 *   (% achevé, statut, dates réelles, baseline), Liens, Ressources et
 *   coûts, Permis (permis seulement), Avancé (contrainte), Notes.
 * Les onglets sans objet pour le type disparaissent : une phase n'a que
 * Général, Ressources et coûts, Notes.
 *
 * EN MODIFICATION, PAS DE CHOIX DU TYPE : le type se lit dans le titre.
 *
 * UNE ERREUR DANS UN ONGLET NON AFFICHÉ L'AFFICHE : sans quoi
 * l'enregistrement serait refusé sans qu'on voie pourquoi.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « liste d'onglets absente de la fiche ». Le discriminant — la
 * fiche s'ouvre, nom et dates affichés — passe. */

/* Les onglets AFFICHÉS : un onglet sans objet pour le type reste dans le
 * DOM, masqué (hidden) ; allTextContents le lirait quand même. */
const onglets = (page) => page.locator('#taskModalOverlay [role="tablist"] [role="tab"]:visible');
const libelles = async (page) => (await onglets(page).allTextContents()).map(s => s.replace(/\d+$/, '').trim());
const onglet = (page, cle) => page.locator(`#taskModalOverlay [role="tab"][data-onglet="${cle}"]`);

test('la fiche de tâche est rangée en onglets, selon le type', async ({ page }) => {
    const projectName = `E2E FicheOnglets ${Date.now()}`;
    const taskName = `Tâche onglets ${Date.now()}`;
    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    const modal = page.locator('#taskModalOverlay');

    /* DISCRIMINANT — la fiche s'ouvre, nom et dates prévues affichés.
       Ferme « pas d'onglets parce que la fiche ne s'est pas ouverte ».
       Passe avant comme après. */
    await expect(modal, 'la fiche s\'ouvre').toBeVisible();
    await expect(page.locator('#taskName'), 'le nom est affiché').toBeVisible();
    await expect(page.locator('#taskStart'), 'le début prévu est affiché').toBeVisible();

    // --- L'ASSERTION CENTRALE ---
    await expect(modal.locator('[role="tablist"]'), 'liste d\'onglets absente de la fiche').toHaveCount(1);

    /* Création d'une tâche : six onglets, Général affiché. */
    expect(await libelles(page), 'onglets d\'une tâche').toEqual(['Général', 'Avancement', 'Liens', 'Ressources et coûts', 'Avancé', 'Notes']);
    await expect(onglet(page, 'general'), 'la fiche s\'ouvre sur Général').toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#taskProgress'), 'le % achevé est dans Avancement, pas affiché').toBeHidden();

    await onglet(page, 'avancement').click();
    await expect(page.locator('#taskProgress'), 'Avancement montre le % achevé').toBeVisible();
    await expect(page.locator('#taskActualStart'), 'et les dates réelles').toBeVisible();
    await expect(page.locator('#taskStart'), 'Général est masqué').toBeHidden();
    await expect(page.locator('#taskName'), 'le nom reste visible').toBeVisible();

    await onglet(page, 'avance').click();
    await expect(page.locator('#taskConstraint'), 'Avancé montre la contrainte').toBeVisible();
    await onglet(page, 'notes').click();
    await expect(page.locator('#taskDesc'), 'Notes montre la description').toBeVisible();

    /* Selon le type : une phase n'a que trois onglets ; un permis a le sien. */
    await page.locator('.type-switcher-btn[data-type="phase"]').click();
    expect(await libelles(page), 'onglets d\'une phase').toEqual(['Général', 'Ressources et coûts', 'Notes']);
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    expect(await libelles(page), 'onglets d\'un permis').toEqual(['Général', 'Avancement', 'Liens', 'Ressources et coûts', 'Permis', 'Avancé', 'Notes']);
    await onglet(page, 'permis').click();
    await expect(page.locator('#permitType'), 'Permis montre ses champs').toBeVisible();

    /* Créer une tâche simple. */
    await page.locator('.type-switcher-btn[data-type="task"]').click();
    await page.locator('#taskName').fill(taskName);
    await onglet(page, 'general').click();
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-14');
    await modal.getByRole('button', { name: 'Créer' }).click();
    await expect(modal).toBeHidden();

    /* EN MODIFICATION : pas de choix du type ; le type est dans le titre ;
       la fiche se rouvre sur Général. */
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    await barre.dblclick();
    await expect(modal).toBeVisible();
    await expect(page.locator('#taskModalTitle'), 'titre de modification').toContainText('Modifier la tâche');
    await expect(page.locator('#taskModalTitle'), 'le type est dans le titre').toContainText('Tâche');
    await expect(modal.locator('.type-switcher-btn').first(), 'pas de choix du type en modification').toBeHidden();
    await expect(onglet(page, 'general'), 'rouverte sur Général').toHaveAttribute('aria-selected', 'true');

    /* UNE ERREUR DANS UN ONGLET NON AFFICHÉ L'AFFICHE. */
    await onglet(page, 'avancement').click();
    await page.locator('#taskActualStart').fill('2026-08-12');
    await page.locator('#taskActualFinish').fill('2026-08-11');
    await onglet(page, 'notes').click();
    await modal.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(onglet(page, 'avancement'), 'l\'erreur ramène à Avancement').toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#taskActualError'), 'et son message est affiché').toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await deleteActiveProject(page);
});
