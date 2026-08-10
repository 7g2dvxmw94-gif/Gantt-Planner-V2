import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Calendrier ouvré et jours fériés français.
 *
 * Aucune section du plan de test ne couvre ce sujet : c'est un manque du
 * plan lui-même, pas seulement des tests. Or tout repose dessus — durées,
 * décalage des successeurs, calcul des coûts — et une régression y est
 * parfaitement silencieuse : une date fausse reste une date plausible.
 *
 * Le calendrier n'a AUCUNE interface (ni settings-panel.js ni app.js
 * n'exposent workingDays, useFrenchHolidays ou alsaceMoselle). Ces tests
 * portent donc sur les valeurs par défaut — lundi-vendredi + fériés
 * français — soit la seule configuration réellement atteignable par un
 * utilisateur.
 *
 * Les dates sont choisies pour qu'un moteur qui ne connaîtrait QUE les
 * week-ends donne une réponse différente ; sans cette précaution, le test
 * ne prouverait rien sur les fériés. Chaque cas indique la réponse
 * erronée correspondante.
 */

/* Fête du Travail 2026 : VENDREDI 1er mai. Un jour ouvré au sens des
   week-ends seuls : le recalage vers le lundi suivant ne peut donc pas
   s'expliquer autrement que par la prise en compte du férié. */
const FETE_TRAVAIL = '2026-05-01';

test('la durée se compte en jours ouvrés, fériés compris, et survit à l’aller-retour', async ({ page }) => {
    const projectName = `E2E Calendrier ${Date.now()}`;
    const taskName = `Tâche ouvrée ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-05-11');       // lundi
    await page.locator('#taskDuration').fill('5');

    /* 5 jours ouvrés depuis lundi 11 mai : 11, 12, 13, (jeudi 14 =
       Ascension, sauté), 15, puis 18. Fin attendue : lundi 18 mai.
       L'Ascension est une fête MOBILE, dérivée de easterSunday()
       (Pâques + 39 j, Pâques tombant le 5 avril 2026) : c'est la partie
       du calcul la plus susceptible de casser en silence, un férié fixe
       n'étant qu'une constante.
       Un moteur ignorant les fériés répondrait vendredi 15 mai ; un moteur
       ignorant aussi les week-ends, vendredi 15 également — d'où le choix
       d'une semaine contenant un férié EN PLUS du week-end. */
    await expect(page.locator('#taskEnd')).toHaveValue('2026-05-18');

    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    /* L'aller-retour est le cœur du test : la durée est ÉCRITE en jours
       ouvrés par le formulaire, elle doit être RELUE dans la même unité.
       Sinon le champ ment à la réouverture, et la moindre modification
       ultérieure propage cette durée erronée jusqu'à la date de fin —
       ici 8 jours ouvrés depuis le 11 mai, soit une fin repoussée au
       21 mai sans que l'utilisateur ait touché aux dates. */
    await bar.dblclick();
    await expect(page.locator('#taskModalOverlay')).toBeVisible();
    await expect(page.locator('#taskStart')).toHaveValue('2026-05-11');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-05-18');
    await expect(page.locator('#taskDuration')).toHaveValue('5');

    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});

test('une tâche qui démarrerait un jour férié est recalée au jour ouvré suivant', async ({ page }) => {
    const projectName = `E2E Ferie ${Date.now()}`;
    const taskName = `Tâche 1er mai ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill(FETE_TRAVAIL);
    await page.locator('#taskDuration').fill('1');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    /* store.addTask() recale la paire de dates sur des jours ouvrés
       (_snapToWorkingDays). Le 1er mai 2026 tombant un vendredi, seul le
       férié peut expliquer le report au lundi 4 : un moteur limité aux
       week-ends laisserait la tâche au vendredi. */
    await bar.dblclick();
    await expect(page.locator('#taskModalOverlay')).toBeVisible();
    await expect(page.locator('#taskStart')).toHaveValue('2026-05-04');
    await expect(page.locator('#taskEnd')).toHaveValue('2026-05-04');

    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
