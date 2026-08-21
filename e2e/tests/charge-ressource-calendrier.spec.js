import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { snapshotCustomization } from '../cleanup.js';

/* Couvre TEST_PLAN.md § C3, volets 3 et 4 — « Pourcentage de charge » et
 * « Barre rouge (>100%) ». La vue Ressources n'avait aucun test.
 *
 * LE DÉFAUT : le calcul de charge ignore le calendrier ouvré.
 *
 * _calculateResourceWorkload() (app.js:1107-1120) balaie la période jour à
 * jour et décide de chaque journée ainsi :
 *
 *     const day = current.getDay();
 *     if (day !== 0 && day !== 6) { ... }
 *
 * Samedi et dimanche sont donc chômés en dur, et les jours fériés comptés
 * comme ouvrés. Or l'application sait faire mieux : isWorkingDay(date,
 * calendar) (utils.js:557) honore les jours ouvrés configurés ET les
 * fériés, et store.getCalendar() fournit le calendrier. Tout le reste du
 * moteur l'utilise — durées, recalage, dépendances. Ce calcul-ci est le
 * seul à s'en passer.
 *
 * CONSÉQUENCE MESURÉE ICI : une équipe qui travaille le samedi voit la
 * charge de ce jour disparaître deux fois — au numérateur (la journée
 * allouée n'est pas comptée) et au dénominateur (elle n'est pas un jour
 * ouvré). Une ressource occupée à plein temps un samedi affiche 0 %.
 *
 * Le cas est choisi pour être arithmétiquement sans appel : une seule
 * tâche, sur un seul samedi. La barre « Charge globale » borne sa période
 * aux dates des tâches assignées (app.js:1135-1137), soit ici ce samedi
 * seul. Attendu 100 % ; le code affiche 0 %.
 *
 * LE RÉGLAGE EST GLOBAL AU COMPTE, comme dans calendar-settings.spec.js :
 * une fuite casserait les autres specs. D'où la restauration explicite en
 * fin de test, doublée de la capture confiée au filet de nettoyage — le
 * test peut échouer avant sa dernière ligne.
 */

/* Samedi 19 décembre 2026. Décembre ne porte qu'un férié français, le 25 :
   aucune interférence avec le second volet du défaut. */
const SAMEDI_TRAVAILLE = '2026-12-19';

const SAMEDI_BTN = '.calendar-day-btn[data-day="6"]';

async function ouvrirOngletGeneral(page) {
    await page.locator('#settingsBtn').click();
    await page.locator('.settings-tab[data-tab="general"]').click();
    await expect(page.locator('#settingsWorkingDays')).toBeVisible();
}

async function fermerReglages(page) {
    await page.locator('#settingsSaveBtn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: 'Réglages enregistrés' }))
        .toBeVisible({ timeout: 10_000 });
}

test('la charge d\'une ressource compte les samedis quand ils sont ouvrés', async ({ page }) => {
    const suffixe      = Date.now();
    const nomProjet    = `E2E ChargeSamedi ${suffixe}`;
    const nomRessource = `Ressource Samedi ${suffixe}`;
    const nomTache     = `Astreinte samedi ${suffixe}`;

    await page.goto('index.html');
    await waitForAppReady(page);
    await snapshotCustomization(page);
    await createProject(page, nomProjet);

    // --- Déclarer le samedi ouvré, AVANT de créer la tâche ---
    await ouvrirOngletGeneral(page);
    await expect(page.locator(SAMEDI_BTN)).not.toHaveClass(/active/);
    await page.locator(SAMEDI_BTN).click();
    await fermerReglages(page);

    // --- Une ressource, créée dans le projet actif ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(nomRessource);
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();

    /* PREMIER DISCRIMINANT — la ressource existe et sa carte est rendue. */
    const carte = page.locator('.resource-card', { hasText: nomRessource });
    await expect(carte).toBeVisible({ timeout: 10_000 });

    // --- Une tâche d'un seul samedi, assignée à cette ressource ---
    await page.locator('#tabTimeline').click();
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nomTache);
    await page.locator('#taskStart').fill(SAMEDI_TRAVAILLE);
    await page.locator('#taskEnd').fill(SAMEDI_TRAVAILLE);

    const ligneEquipe = page.locator('#taskModalOverlay .assignee-item', { hasText: nomRessource });
    await expect(ligneEquipe).toBeVisible();
    await ligneEquipe.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* DEUXIÈME DISCRIMINANT, et le plus important — la preuve FONCTIONNELLE
       que le réglage a pris effet, et non la simple lecture d'une case
       cochée. _snapToWorkingDays() appelle nextWorkingDay() : samedi resté
       chômé, la tâche serait partie au lundi 21. Qu'elle reste au 19
       établit que le moteur tient bien le samedi pour ouvré — sans quoi
       une charge nulle plus bas ne prouverait rien du tout. */
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(SAMEDI_TRAVAILLE);
    await expect(page.locator('#taskEnd')).toHaveValue(SAMEDI_TRAVAILLE);
    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- La vue Ressources ---
    await page.locator('#tabResources').click();
    await expect(carte).toBeVisible({ timeout: 10_000 });

    /* TROISIÈME DISCRIMINANT — l'assignation a bien atteint la carte. La
       liste des tâches est alimentée indépendamment du calcul de charge :
       si elle est vide, c'est l'assignation qui a échoué, pas
       l'arithmétique, et le rouge suivant serait ambigu. */
    await expect(carte.locator('.resource-task-item', { hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       La barre « Charge globale » borne sa période aux dates des tâches
       assignées : ici ce seul samedi. Un jour ouvré, une tâche dessus,
       donc 100 %. Le code n'y voit qu'un week-end : dénominateur nul,
       charge affichée 0 %. */
    const chargeGlobale = carte.locator('.resource-workload', { hasText: 'Charge globale' });
    await expect(chargeGlobale).toBeVisible();
    await expect(chargeGlobale).toContainText('100%', { timeout: 10_000 });

    // --- Restauration : le calendrier est partagé par tout le compte ---
    await ouvrirOngletGeneral(page);
    await page.locator(SAMEDI_BTN).click();
    await expect(page.locator(SAMEDI_BTN)).not.toHaveClass(/active/);
    await fermerReglages(page);

    await deleteActiveProject(page);
});
