import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B2 (créer une phase / groupe).

   Une phase ne se saisit pas, elle se déduit : ses dates sont l'enveloppe
   de celles de ses enfants, et son avancement leur moyenne (store.js,
   _recalculatePhase). C'est une régression silencieuse par excellence —
   une phase mal calée reste une barre plausible à l'écran. Le test porte
   donc sur l'arithmétique elle-même, pas sur la seule présence de la barre.

   Écart avec le plan : son étape 4 fait saisir des dates pour la phase. Le
   formulaire les masque justement pour ce type (task-modal.js,
   _setTaskType), puisqu'elles sont dérivées. L'étape est donc vérifiée
   telle qu'elle se comporte réellement — les champs de date disparaissent.

   Son étape 6 (« tâche imbriquée correctement ») est vérifiée par sa
   conséquence plutôt que par une classe d'indentation : si la phase se
   recale sur ses enfants, c'est que le rattachement a bien pris. */

/* Les dates des enfants sont volontairement éloignées d'aujourd'hui. Une
   phase créée sans enfant hérite des valeurs par défaut du formulaire
   (aujourd'hui → +7 jours) : avec des enfants trop proches, une phase
   restée figée sur ces défauts serait indiscernable d'une phase
   correctement recalculée. Toutes les dates tombent un jour ouvré, pour
   qu'aucune ne soit décalée par le recalage de addTask(). */
const ENFANT_A = { debut: '2026-08-24', fin: '2026-08-26' };   // lundi → mercredi
const ENFANT_B = { debut: '2026-09-07', fin: '2026-09-09' };   // lundi → mercredi

/** Bords gauche et droit d'une barre, en coordonnées écran.
 *
 *  Les barres sont comparées ENTRE ELLES plutôt qu'à des pixels attendus :
 *  la phase doit commencer exactement où commence son premier enfant et
 *  finir où finit le dernier, quels que soient le zoom et la largeur des
 *  colonnes. Barres de tâche et barre de phase sont posées par le même
 *  calcul (gantt-renderer.js, début → fin + 1 jour), donc leurs bords
 *  coïncident au pixel près. */
async function bords(locator) {
    const box = await locator.boundingBox();
    return box && { gauche: box.x, droit: box.x + box.width };
}

async function creerTacheEnfant(page, { nom, debut, fin, phase, progression }) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.locator('#taskParent').selectOption({ label: phase });
    if (progression !== undefined) {
        await page.locator('#taskProgress').fill(String(progression));
        await expect(page.locator('#taskModalOverlay .progress-input-label'))
            .toHaveText(`${progression}%`);
    }
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
}

test('une phase couvre ses tâches enfants et moyenne leur avancement', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E Phase ${suffixe}`;
    const phaseName = `Phase Conception ${suffixe}`;
    const nomA = `Étude ${suffixe}`;
    const nomB = `Livraison ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // --- B2.1 / B2.2 : le type « Phase » adapte le formulaire ---
    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="phase"]').click();
    await expect(page.locator('#taskStart')).toBeHidden();
    await expect(page.locator('#taskEnd')).toBeHidden();

    // --- B2.3 / B2.5 : création, la phase se rend comme une barre dédiée ---
    await page.locator('#taskName').fill(phaseName);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const phaseBar = page.locator('.gantt-bar.phase-bar');

    /* Une phase sans enfant reste MASQUÉE, et c'est voulu :
       _applyFiltersToTimeline() (app.js) n'affiche une phase que si au
       moins un de ses enfants est visible. La ligne existe dans le DOM,
       avec un display:none posé à chaque rafraîchissement. Une phase vide
       ne dit rien sur un planning — l'assertion documente la règle plutôt
       que de la contourner. */
    await expect(phaseBar).toBeAttached();
    await expect(phaseBar).toBeHidden();

    // --- B2.6 : deux tâches rattachées à la phase ---
    // La première reste à 0 %, la seconde monte à 50 % : la moyenne
    // attendue (25 %) ne coïncide donc avec aucune des deux valeurs, ni
    // avec le 0 % d'une phase qui n'aurait jamais été recalculée.
    await creerTacheEnfant(page, { nom: nomA, ...ENFANT_A, phase: phaseName, progression: 0 });
    await creerTacheEnfant(page, { nom: nomB, ...ENFANT_B, phase: phaseName, progression: 50 });

    const barreA = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomA });
    const barreB = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomB });
    await expect(barreA).toBeVisible({ timeout: 10_000 });
    await expect(barreB).toBeVisible({ timeout: 10_000 });

    // La phase, elle, sort de l'ombre dès qu'elle a un enfant visible.
    await expect(phaseBar).toBeVisible({ timeout: 10_000 });
    await expect(phaseBar).toHaveAttribute('aria-label', new RegExp(phaseName));

    // --- L'enveloppe : début du premier enfant, fin du dernier ---
    // Aucun rechargement volontaire ici : la phase doit suivre ses enfants
    // dès leur rattachement. store.initFromSupabase() recalcule toutes les
    // phases au chargement, si bien qu'un rechargement masquerait
    // précisément ce qu'on cherche à vérifier.
    await expect.poll(async () => {
        const phase = await bords(phaseBar);
        const enfant = await bords(barreA);
        return phase && enfant ? Math.abs(phase.gauche - enfant.gauche) : null;
    }, { timeout: 10_000 }).toBeLessThanOrEqual(1);

    await expect.poll(async () => {
        const phase = await bords(phaseBar);
        const enfant = await bords(barreB);
        return phase && enfant ? Math.abs(phase.droit - enfant.droit) : null;
    }, { timeout: 10_000 }).toBeLessThanOrEqual(1);

    // --- La moyenne des avancements ---
    // L'aria-label est reconstruit à chaque rendu depuis la tâche du store
    // (gantt-renderer.js) : il reflète l'avancement réellement calculé, pas
    // l'état d'un formulaire.
    await expect(phaseBar).toHaveAttribute('aria-label', /: 25% complété/);

    await deleteActiveProject(page);
});
