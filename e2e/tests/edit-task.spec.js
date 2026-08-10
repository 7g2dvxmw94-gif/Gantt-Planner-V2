import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B5 (modifier une tâche) : la modal d'édition doit
   s'ouvrir pré-remplie, accepter un changement de nom, de date de fin, de
   couleur, de priorité et de progression, puis répercuter le tout sur le
   Gantt — et surtout persister dans le store, ce que vérifie la
   réouverture de la modal en fin de test.

   La modal s'ouvre au DOUBLE-clic, conformément au plan ; le clic simple
   sélectionne (voir select-task.spec.js).

   Un écart subsiste avec le plan : celui-ci dit « changer le statut en
   "En cours" », alors que le champ statut est volontairement `disabled` et
   dérivé de la progression (task-modal.js, _syncStatusFromProgress :
   0 % → À faire, 1-99 % → En cours, 100 % → Terminé). L'étape « statut »
   est donc vérifiée comme conséquence du passage de la progression à 50 %,
   pas comme une action indépendante. */

const VERT = '#10B981';   // TASK_COLORS[5], utils.js — distinct de l'Indigo par défaut

test('modifier une tâche depuis la modal : nom, date de fin, couleur, priorité et progression', async ({ page }) => {
    const projectName = `E2E Edit ${Date.now()}`;
    const taskName = `Tâche à modifier ${Date.now()}`;
    const newTaskName = `${taskName} (modifiée)`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // --- Création de la tâche de départ (valeurs par défaut : priorité
    //     moyenne, progression 0 %, couleur Indigo) ---
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    /* La création émet le MÊME toast que l'édition : taskModal.init() reçoit
       un unique callback _onSave, partagé par les modes création et édition,
       qui affiche toujours toast.taskUpdated (js/app.js:62). Les toasts
       vivent 3,3 s (app.js:5004) — soit plus que la durée des étapes
       ci-dessous. Sans cette attente, l'assertion de fin trouve deux toasts
       identiques et échoue en strict mode ; pire, un .last() y passerait
       parfois sur le toast de création, donc à tort. */
    const toastMaj = page.locator('#toastContainer .toast', { hasText: 'Tâche mise à jour' });
    await expect(toastMaj).toHaveCount(0, { timeout: 10_000 });

    // --- B5.1 : ouvrir la modal d'édition, pré-remplie ---
    await bar.dblclick();
    const modal = page.locator('#taskModalOverlay');
    await expect(modal).toBeVisible();
    await expect(page.locator('#taskModalTitle')).toContainText('Modifier la tâche');
    await expect(page.locator('#taskName')).toHaveValue(taskName);
    await expect(page.locator('#taskStart')).toHaveValue('2026-08-10');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-12');
    await expect(page.locator('#taskPriority')).toHaveValue('medium');
    await expect(page.locator('#taskProgress')).toHaveValue('0');

    // --- B5.2 à B5.7 : modifier chaque champ ---
    await page.locator('#taskName').fill(newTaskName);
    await page.locator('#taskEnd').fill('2026-08-14');
    await page.locator(`#taskModalOverlay .color-swatch[data-color="${VERT}"]`).click();
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskProgress').fill('50');

    // Le statut suit la progression sans intervention de l'utilisateur.
    await expect(page.locator('#taskStatus')).toHaveValue('in_progress');
    await expect(modal.locator('.progress-input-label')).toHaveText('50%');

    // --- B5.8 : enregistrer, puis vérifier le rendu sur le Gantt ---
    // Bouton cherché dans la modal : le panneau Réglages a lui aussi un
    // bouton « Enregistrer » (i18n settings.btnSave).
    await modal.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modal).toBeHidden();
    await expect(toastMaj).toBeVisible();

    const editedBar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: newTaskName });
    await expect(editedBar).toBeVisible({ timeout: 10_000 });
    // L'aria-label de la barre est reconstruit à chaque rendu à partir de la
    // tâche du store (gantt-renderer.js:562) : il reflète donc la progression
    // réellement enregistrée, pas seulement l'état du formulaire.
    await expect(editedBar).toHaveAttribute('aria-label', /50% complété/);
    // Le remplissage de progression n'existe dans le DOM que si progress > 0.
    await expect(editedBar.locator('.gantt-bar-progress')).toBeVisible();

    // --- Persistance : rouvrir la modal doit rendre les nouvelles valeurs ---
    await editedBar.dblclick();
    await expect(modal).toBeVisible();
    await expect(page.locator('#taskName')).toHaveValue(newTaskName);
    await expect(page.locator('#taskEnd')).toHaveValue('2026-08-14');
    await expect(page.locator('#taskPriority')).toHaveValue('high');
    await expect(page.locator('#taskProgress')).toHaveValue('50');
    await expect(page.locator(`#taskModalOverlay .color-swatch[data-color="${VERT}"]`)).toHaveClass(/active/);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await deleteActiveProject(page);
});
