import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C4, volet coûts.
 *
 * LE DÉFAUT : la facturation compte les jours fériés comme travaillés.
 *
 * getTaskCosts() (store.js:2774) mesure les jours facturables ainsi :
 *
 *     const workingDays = countWorkingDays(task.startDate, task.endDate);
 *
 * Or countWorkingDays() (utils.js:114) ne prend AUCUN paramètre de
 * calendrier et tranche en dur :
 *
 *     if (day !== 0 && day !== 6) count++;
 *
 * Lundi-vendredi, fériés ignorés. C'est le dernier endroit du moteur à
 * raisonner ainsi : partout ailleurs — durées, recalage, dépendances,
 * et la charge des ressources depuis #45 — c'est workingDaysBetween(…,
 * cal) qui décide, laquelle s'appuie sur isWorkingDay() et honore les
 * fériés comme les jours ouvrés configurés.
 *
 * LA CONTRADICTION EST DÉJÀ ÉCRITE DANS LE CODE. task-modal.js:1103
 * affirme que la durée affichée est « coherente avec le moteur et avec le
 * calcul de couts (countWorkingDays) », alors que la ligne suivante
 * appelle workingDaysBetween(start, end, cal). Les deux ne peuvent pas
 * s'accorder dès qu'un férié tombe dans la période : quelqu'un a cru
 * l'invariant vrai, il ne l'est pas.
 *
 * Ce test met les deux réponses côte à côte dans la même page : la fiche
 * de tâche annonce 4 jours ouvrés, la vue Coûts en facture 5.
 *
 * AUCUN RÉGLAGE GLOBAL N'EST TOUCHÉ — les fériés français sont actifs par
 * défaut (utils.js:520, useFrenchHolidays: true). Contrairement à
 * charge-ressource-calendrier.spec.js, ce test ne peut donc pas fuir sur
 * les autres specs.
 */

/* Du mardi 5 au lundi 11 mai 2026. Le vendredi 8 mai est la Victoire 1945
   (utils.js frenchHolidays), et il est INTÉRIEUR à la période : c'est
   nécessaire, car _snapToWorkingDays() refuse de terminer une tâche sur un
   jour chômé et aurait recalé la fin.

     - jours réellement ouvrés : 5, 6, 7, 11          → 4
     - décompte lundi-vendredi : 5, 6, 7, 8, 11       → 5

   Ni le 1er mai, ni l'Ascension (14 mai), ni le lundi de Pentecôte
   (25 mai) ne tombent dans l'intervalle. */
const DEBUT = '2026-05-05';
const FIN   = '2026-05-11';

const JOURS_OUVRES_REELS = '4';

/* Taux horaire 10 €/h, journée de 8 h (HOURS_PER_DAY dans getTaskCosts) :
   80 € par jour facturé. Le même taux que full-workflow.spec.js, et des
   montants sous 1000 € pour éviter l'abréviation « K€ » de
   formatCurrency() et pouvoir comparer le texte tel quel. */
const COUT_ATTENDU = '320 €';   // 4 jours × 80 €
// Le code produit 400 € — 5 jours × 80 €, le férié facturé.

test('les coûts ne facturent pas les jours fériés', async ({ page }) => {
    const suffixe      = Date.now();
    const nomProjet    = `E2E CoutsFerie ${suffixe}`;
    const nomRessource = `Ressource Ferie ${suffixe}`;
    const nomTache     = `Semaine du 8 mai ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Une ressource à 10 €/h ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(nomRessource);
    await modaleRessource.locator('.res-rate-toggle-btn', { hasText: 'Taux horaire' }).click();
    await modaleRessource.locator('#resRate').fill('10');
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible({ timeout: 10_000 });

    // --- Une tâche enjambant le 8 mai, assignée à cette ressource ---
    await page.locator('#tabTimeline').click();
    await page.locator('#addTaskBtn').click();
    const modaleTache = page.locator('#taskModalOverlay');
    await modaleTache.locator('#taskName').fill(nomTache);
    await modaleTache.locator('#taskStart').fill(DEBUT);
    await modaleTache.locator('#taskEnd').fill(FIN);
    await modaleTache.locator('.assignee-item', { hasText: nomRessource })
        .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modaleTache).toBeHidden({ timeout: 15_000 });

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* PREMIER DISCRIMINANT — la période n'a pas bougé, et surtout
       l'application elle-même annonce QUATRE jours ouvrés. Ce champ est
       calculé par workingDaysBetween(start, end, cal), qui honore les
       fériés. C'est la moitié « juste » de la contradiction : sans elle,
       un montant inattendu plus bas pourrait venir de dates recalées ou
       d'un décompte différent, et non de la facturation. */
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(DEBUT);
    await expect(page.locator('#taskEnd')).toHaveValue(FIN);
    await expect(page.locator('#taskDuration')).toHaveValue(JOURS_OUVRES_REELS);
    await page.keyboard.press('Escape');
    await expect(modaleTache).toBeHidden();

    // --- La vue Coûts ---
    await page.locator('#tabCosts').click();
    const ligne = page.locator('tr.costs-task-row', { hasText: nomTache });

    /* DEUXIÈME DISCRIMINANT — la tâche est bien facturée. Une ligne
       absente signifierait que l'assignation ou la vue a échoué, et le
       montant suivant ne prouverait rien. */
    await expect(ligne).toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Quatre jours ouvrés à 80 € font 320 €. La facturation en compte
       cinq et affiche 400 € : le 8 mai, chômé, est facturé. */
    await expect(ligne.locator('td').nth(5)).toHaveText(COUT_ATTENDU);

    /* Le total reprend la même erreur — une seule tâche au projet, donc
       le même montant. Placé APRÈS l'assertion par ligne : si les deux
       divergeaient, c'est le cumul qu'il faudrait regarder, pas le
       calcul unitaire. */
    await expect(page.locator('.costs-kpi').first().locator('.costs-kpi-value'))
        .toHaveText(COUT_ATTENDU);

    await deleteActiveProject(page);
});
