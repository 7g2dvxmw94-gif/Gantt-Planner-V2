import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C4, volet durées.
 *
 * LE DÉFAUT : daysBetween() compte un jour de trop dès qu'une période
 * enjambe le passage à l'heure d'hiver.
 *
 *     export function daysBetween(start, end) {
 *         const startDate = parseISO(start);
 *         const endDate   = parseISO(end);
 *         const diffTime  = endDate.getTime() - startDate.getTime();
 *         return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 *     }
 *
 * parseISO() rend des minuits LOCAUX. Soustraire deux minuits locaux ne
 * donne 24 h que si aucun changement d'heure ne les sépare : le dimanche
 * de bascule d'automne dure 25 h, et Math.ceil(25 / 24) vaut 2.
 *
 * Le printemps passe à travers les mailles — le dimanche dure 23 h et
 * Math.ceil(23 / 24) vaut bien 1 —, ce qui explique qu'un seul des deux
 * changements annuels soit visible.
 *
 * POURQUOI PERSONNE NE L'AVAIT VU : la CI tourne en UTC, un fuseau sans
 * heure d'été. Le défaut est invisible tant qu'on ne se place pas dans un
 * fuseau qui en pratique... est celui de l'application. Elle code les
 * jours fériés FRANÇAIS en dur (utils.js frenchHolidays) et son interface
 * est en français : ses utilisateurs sont en Europe/Paris, précisément là
 * où le calcul se trompe. D'où le timezoneId ci-dessous.
 *
 * PORTÉE — daysBetween() a une vingtaine d'appelants. Le plus visible est
 * la colonne « durée » du tableau des coûts, mesurée ici. Mais
 * gantt-renderer.js s'en sert aussi pour la largeur et le décalage des
 * barres : une barre enjambant la bascule est dessinée un jour trop
 * large. Et getTaskCosts() en tire calendarDays, qui devient le nombre de
 * jours FACTURÉS dès qu'une ressource travaille le week-end.
 */

/* Le fuseau de l'application. Sans lui le test passe : en UTC le calcul
   est juste, faute de changement d'heure. */
test.use({ timezoneId: 'Europe/Paris' });

/* Du vendredi 23 au lundi 26 octobre 2026. Le dimanche 25 est la bascule
   vers l'heure d'hiver en Europe.

     - jours calendaires : 23, 24, 25, 26            → 4
     - ce que compte daysBetween() à Paris           → 5

   Bornes choisies sur des jours OUVRÉS : _snapToWorkingDays() aurait
   recalé une période commençant le samedi 24. Aucun férié français en
   octobre — la Toussaint tombe le 1er novembre. */
const DEBUT = '2026-10-23';
const FIN   = '2026-10-26';

const JOURS_CALENDAIRES = '4 j';   // le code affiche « 5 j »
const JOURS_OUVRES      = '2';     // vendredi + lundi

test('la durée d\'une tâche ne gagne pas un jour au changement d\'heure', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E HeureHiver ${suffixe}`;
    const nomTache  = `Bascule automne ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Une tâche enjambant le dimanche de bascule ---
    await page.locator('#addTaskBtn').click();
    const modale = page.locator('#taskModalOverlay');
    await modale.locator('#taskName').fill(nomTache);
    await modale.locator('#taskStart').fill(DEBUT);
    await modale.locator('#taskEnd').fill(FIN);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* PREMIER DISCRIMINANT — les bornes n'ont pas bougé, et le champ Durée
       annonce 2 jours ouvrés. Ce champ passe par workingDaysBetween(), qui
       avance d'un jour à la fois avec setDate() et reste donc juste malgré
       la bascule. C'est la moitié « saine » du calcul : elle établit que la
       période est bien celle voulue, et qu'un écart plus bas vient de
       l'arithmétique en millisecondes, pas des dates. */
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(DEBUT);
    await expect(page.locator('#taskEnd')).toHaveValue(FIN);
    await expect(page.locator('#taskDuration')).toHaveValue(JOURS_OUVRES);
    await page.keyboard.press('Escape');
    await expect(modale).toBeHidden();

    // --- La vue Coûts, où la durée calendaire est affichée ---
    await page.locator('#tabCosts').click();
    const ligne = page.locator('tr.costs-task-row', { hasText: nomTache });

    /* DEUXIÈME DISCRIMINANT — la tâche figure bien au tableau. Une ligne
       absente signifierait que la vue a échoué, et la cellule suivante ne
       prouverait rien. */
    await expect(ligne).toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Du 23 au 26 il y a quatre jours. Le dimanche 25 en dure 25, et
       daysBetween() en conclut qu'il y en a cinq. */
    await expect(ligne.locator('td').nth(2)).toHaveText(JOURS_CALENDAIRES);

    await deleteActiveProject(page);
});
