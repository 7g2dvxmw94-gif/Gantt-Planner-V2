import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique).

   Deux scénarios, et le second existe à cause d'une limite du premier.

   Le premier n'a que 2 tâches en chaîne : aucune n'a de marge, donc TOUTES
   sont critiques. Un tel cas ne distingue pas un calcul de marge correct
   d'une implémentation qui renverrait simplement toutes les tâches — il
   passerait contre l'une comme contre l'autre.

   Le second construit donc un losange, avec une branche courte qui possède
   une vraie marge et doit rester NON critique. C'est cette assertion
   négative qui donne sa valeur au test : elle échoue si le calcul se
   contente de tout marquer. */

test('activer le chemin critique surligne les tâches sans marge', async ({ page }) => {
    const projectName = `E2E CP ${Date.now()}`;
    const nameA = `Tâche A ${Date.now()}`;
    const nameB = `Tâche B ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameA);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nameB);
    await page.locator('#taskStart').fill('2026-08-13');
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const barA = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameA });
    const barB = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nameB });
    await expect(barA).toBeVisible({ timeout: 10_000 });
    await expect(barB).toBeVisible({ timeout: 10_000 });

    // Lier B à A (Fin→Début) pour former l'unique chaîne du projet.
    await barB.dblclick();
    const predGroup = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    await predGroup.locator('.dep-list > div').filter({ hasText: nameA })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Activer le chemin critique : 2 tâches, une seule chaîne possible,
    // donc marge nulle pour les deux -> toutes deux critiques.
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique : 2 tâches sur 2' })).toBeVisible();
    await expect(barA).toHaveClass(/critical-path/);
    await expect(barB).toHaveClass(/critical-path/);

    // Désactiver : la classe doit disparaître des deux barres.
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique masqué' })).toBeVisible();
    await expect(barA).not.toHaveClass(/critical-path/);
    await expect(barB).not.toHaveClass(/critical-path/);

    await deleteActiveProject(page);
});

/* Losange : deux branches partant du même point convergent vers une
   tâche finale.

       Longue (5 j) ─┐
                     ├─> Finale (3 j)
       Courte (2 j) ─┘

   Le calcul (store.js, getCriticalPath) est un CPM complet : passe avant
   pour les dates au plus tôt, passe arrière pour les dates au plus tard,
   marge = LS − ES, critique quand elle est nulle. Les durées y sont
   comptées en jours CALENDAIRES — d'où des tâches qui ne franchissent
   aucun week-end, pour que la durée saisie soit celle que le calcul voit.

   Marges attendues : la branche longue et la finale sont sur le chemin le
   plus long, marge nulle. La branche courte finit 3 jours avant que la
   finale n'ait besoin d'elle : marge de 3 jours, donc non critique. */
test('une branche parallèle plus courte garde sa marge et n’est pas critique', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E CP marge ${suffixe}`;
    const nomLongue = `Branche longue ${suffixe}`;
    const nomCourte = `Branche courte ${suffixe}`;
    const nomFinale = `Convergence ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    const creer = async (nom, debut, fin) => {
        await page.locator('#addTaskBtn').click();
        await page.locator('#taskName').fill(nom);
        await page.locator('#taskStart').fill(debut);
        await page.locator('#taskEnd').fill(fin);
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(page.locator('#taskModalOverlay')).toBeHidden();
    };

    await creer(nomLongue, '2026-06-01', '2026-06-05');   // lun → ven, 5 j
    await creer(nomCourte, '2026-06-01', '2026-06-02');   // lun → mar, 2 j
    await creer(nomFinale, '2026-06-08', '2026-06-10');   // lun → mer, 3 j

    const barreLongue = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomLongue });
    const barreCourte = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomCourte });
    const barreFinale = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomFinale });
    await expect(barreFinale).toBeVisible({ timeout: 10_000 });

    // Faire converger les deux branches sur la tâche finale.
    await barreFinale.dblclick();
    const predGroup = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    for (const nom of [nomLongue, nomCourte]) {
        await predGroup.locator('.dep-list > div').filter({ hasText: nom })
            .locator('input[type="checkbox"]').check();
    }
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    /* La contrainte la plus tardive (fin de la branche longue, vendredi 5)
       place la finale au lundi 8 — là où elle était déjà. Le vérifier n'est
       pas une formalité : tout le calcul de marge repose sur ces durées, et
       une finale déplacée en changerait les résultats. */
    await barreFinale.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue('2026-06-08');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-06-10');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Activer le chemin critique : 2 tâches critiques sur 3 ---
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique : 2 tâches sur 3' }))
        .toBeVisible();

    await expect(barreLongue).toHaveClass(/critical-path/);
    await expect(barreFinale).toHaveClass(/critical-path/);
    /* L'assertion qui porte tout le test : la branche courte dispose de
       3 jours de marge et ne doit PAS être surlignée. */
    await expect(barreCourte).not.toHaveClass(/critical-path/);

    // --- Désactiver : plus aucune barre surlignée ---
    await page.locator('#criticalPathBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Chemin critique masqué' })).toBeVisible();
    await expect(barreLongue).not.toHaveClass(/critical-path/);
    await expect(barreFinale).not.toHaveClass(/critical-path/);

    await deleteActiveProject(page);
});
