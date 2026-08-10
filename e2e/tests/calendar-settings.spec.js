import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { snapshotCustomization } from '../cleanup.js';

/* Réglage du calendrier ouvré depuis le panneau Réglages.
 *
 * Premier test de la suite à sortir des valeurs par défaut : jusqu'ici le
 * calendrier n'était pas réglable, et calendar.spec.js ne pouvait donc
 * vérifier que lundi-vendredi + fériés français.
 *
 * Le scénario va jusqu'au bout de la chaîne — cocher le samedi, l'écrire
 * dans Supabase, le relire après rechargement, puis constater qu'il change
 * réellement l'arithmétique du moteur. Vérifier l'état de la case aurait
 * prouvé que la case se souvient d'elle-même, rien de plus.
 *
 * Le réglage est GLOBAL au compte, comme le thème et la personnalisation :
 * une fuite casserait les autres specs, task-dependencies en tête, qui
 * attend un saut de week-end. D'où une restauration explicite en fin de
 * test, doublée de la capture confiée au filet de nettoyage — le test
 * peut échouer avant sa dernière ligne.
 */

/* Vendredi 5 juin 2026, sans aucun férié dans le mois. Trois jours ouvrés
   depuis cette date donnent :
     - mardi 9 juin en semaine lundi-vendredi (samedi et dimanche sautés),
     - lundi 8 juin si le samedi devient ouvré.
   Deux résultats distincts : le test ne peut pas passer par accident. */
const DEBUT = '2026-06-05';
const FIN_SANS_SAMEDI = '2026-06-09';
const FIN_AVEC_SAMEDI = '2026-06-08';

const SAMEDI = '.calendar-day-btn[data-day="6"]';

async function ouvrirOngletGeneral(page) {
    await page.locator('#settingsBtn').click();
    await page.locator('.settings-tab[data-tab="general"]').click();
    await expect(page.locator('#settingsWorkingDays')).toBeVisible();
}

test('activer le samedi comme jour ouvré : persisté, et pris en compte par le moteur', async ({ page }) => {
    const projectName = `E2E CalendrierReglage ${Date.now()}`;
    const taskName = `Tâche samedi ${Date.now()}`;
    const toastReglages = page.locator('#toastContainer .toast', { hasText: 'Réglages enregistrés' });

    await page.goto('index.html');
    await waitForAppReady(page);
    await snapshotCustomization(page);
    await createProject(page, projectName);

    // --- Par défaut, le samedi n'est pas travaillé ---
    await ouvrirOngletGeneral(page);
    await expect(page.locator(SAMEDI)).not.toHaveClass(/active/);

    // --- L'activer, puis enregistrer ---
    await page.locator(SAMEDI).click();
    await expect(page.locator(SAMEDI)).toHaveClass(/active/);
    await page.locator('#settingsSaveBtn').click();
    await expect(toastReglages).toBeVisible();

    /* --- Le rechargement repart de l'état serveur ---
       C'est le point que la persistance devait rendre possible : jusqu'ici
       le calendrier n'était écrit nulle part et repartait des valeurs par
       défaut à chaque chargement. */
    await page.reload();
    await waitForAppReady(page);
    await ouvrirOngletGeneral(page);
    await expect(page.locator(SAMEDI)).toHaveClass(/active/);
    await page.locator('#settingsSaveBtn').click();
    await expect(toastReglages).toBeVisible();
    /* Attendre la disparition de ce toast : la restauration de fin de test
       en émet un identique, et deux toasts au même libellé rendraient
       l'assertion ambiguë. */
    await expect(toastReglages).toHaveCount(0, { timeout: 10_000 });

    // --- Le moteur compte désormais le samedi ---
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill(DEBUT);
    await page.locator('#taskDuration').fill('3');
    await expect(page.locator('#taskEnd')).toHaveValue(FIN_AVEC_SAMEDI);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    const bar = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(bar).toBeVisible({ timeout: 10_000 });

    /* Rouvrir : les dates enregistrées ont traversé _snapToWorkingDays()
       avec le calendrier personnalisé, elles ne doivent pas avoir bougé. */
    await bar.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(DEBUT);
    await expect(page.locator('#taskEnd')).toHaveValue(FIN_AVEC_SAMEDI);
    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Restauration explicite : le compte est partagé ---
    await ouvrirOngletGeneral(page);
    await page.locator(SAMEDI).click();
    await expect(page.locator(SAMEDI)).not.toHaveClass(/active/);
    await page.locator('#settingsSaveBtn').click();
    await expect(toastReglages).toBeVisible();

    /* Contrôle de la restauration : la même saisie doit redonner la réponse
       de la semaine lundi-vendredi. Sans cette vérification, un réglage mal
       restauré ne se manifesterait que plus tard, dans une autre spec. */
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskStart').fill(DEBUT);
    await page.locator('#taskDuration').fill('3');
    await expect(page.locator('#taskEnd')).toHaveValue(FIN_SANS_SAMEDI);
    await page.locator('#taskModalOverlay').locator('button', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
