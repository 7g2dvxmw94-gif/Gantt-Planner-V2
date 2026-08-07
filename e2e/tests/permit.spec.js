import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (créer un permis de construire) : le type
   « Permis » révèle les champs réglementaires, et les délais sont calculés
   depuis PERMIT_TYPES / calculatePermitDeadlines (store.js) plutôt que
   saisis à la main.

   C'est la logique la plus spécifique au métier de l'outil, et la seule
   dont une régression serait silencieuse : un délai faux reste un délai
   plausible à l'écran. Le test vérifie donc l'arithmétique elle-même
   (90 j pour un PC, 30 j pour une DP, +30 j en secteur ABF, échéances
   dérivées de la date de dépôt), pas seulement la présence des champs. */

const DEPOSIT = '2026-08-10';
const DECISION_PC = '2026-11-08';   // dépôt + 90 j (PERMIT_TYPES.PC.instructionDays)
const COMPLETENESS = '2026-09-09';  // dépôt + 30 j (délai de complétude)

/** Rend une date ISO comme l'app le fait (utils.js formatDateDisplay).
 *  Calculé DANS la page : le format dépend de la locale et de l'ICU du
 *  navigateur, qu'on ne veut pas réimplémenter — seul le calcul des
 *  échéances est l'objet du test, pas leur mise en forme. */
async function displayDate(page, iso) {
    return page.evaluate((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const locale = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }[localStorage.getItem('gantt_lang')] || 'fr-FR';
        return new Date(y, m - 1, day).toLocaleDateString(locale, {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    }, iso);
}

/** Valeur affichée d'une échéance, repérée par son libellé. */
function deadlineValue(page, label) {
    return page.locator('.permit-deadline-item')
        .filter({ has: page.locator('.permit-deadline-label', { hasText: label }) })
        .locator('.permit-deadline-value');
}

/** Le champ « Date de dépôt » n'a pas d'id : on passe par son libellé. */
function depositField(page) {
    return page.locator('.permit-fields .form-group')
        .filter({ hasText: 'Date de dépôt' })
        .locator('input[type="date"]');
}

/** Ouvre la modal, bascule sur le type « Permis » et nomme la tâche. */
async function openPermitForm(page, name) {
    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(name);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-11-30');
}

test('créer un permis : les champs réglementaires apparaissent et les délais sont calculés', async ({ page }) => {
    const projectName = `E2E Permis ${Date.now()}`;
    const permitName = `PC Bâtiment A ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // --- B4.1 / B4.2 : le type « Permis » révèle les champs spécifiques ---
    await openPermitForm(page, permitName);
    await expect(page.locator('#permitType')).toBeVisible();
    await expect(page.locator('#permitStatus')).toBeVisible();
    await expect(depositField(page)).toBeVisible();

    // --- B4.3 / B4.4 : PC → 90 jours d'instruction, calculés, pas codés en dur ---
    await expect(page.locator('#permitType')).toHaveValue('PC');
    await expect(deadlineValue(page, "Délai d'instruction")).toHaveText('90 jours');

    // Une déclaration préalable retombe à 30 j : si les deux types donnaient
    // la même valeur, l'assertion ci-dessus ne prouverait rien.
    await page.locator('#permitType').selectOption('DP');
    await expect(deadlineValue(page, "Délai d'instruction")).toHaveText('30 jours');
    await page.locator('#permitType').selectOption('PC');
    await expect(deadlineValue(page, "Délai d'instruction")).toHaveText('90 jours');

    /* Secteur ABF : +30 j réglementaires (ABF_EXTRA_DAYS). Le libellé passe
       alors par une clé i18n distincte (permit.deadline.instructionDaysABF)
       qui explicite la majoration — on l'assert en entier, cette mention
       étant justement ce qui permet à l'utilisateur de comprendre d'où
       sortent les 30 jours supplémentaires. */
    await page.locator('#permitABF').check();
    await expect(deadlineValue(page, "Délai d'instruction")).toHaveText('120 jours (ABF +30j)');
    await page.locator('#permitABF').uncheck();
    await expect(deadlineValue(page, "Délai d'instruction")).toHaveText('90 jours');

    // --- Échéances dérivées de la date de dépôt ---
    await depositField(page).fill(DEPOSIT);
    await expect(deadlineValue(page, 'Limite complétude'))
        .toHaveText(await displayDate(page, COMPLETENESS));
    // La décision prévisionnelle est suivie d'un « J-n » : match partiel.
    await expect(deadlineValue(page, 'Décision prévisionnelle'))
        .toContainText(await displayDate(page, DECISION_PC));

    // --- B4.5 : création, le permis apparaît sur le Gantt ---
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
    await expect(page.locator('.gantt-permit[data-task-id]').filter({ hasText: permitName }))
        .toBeVisible({ timeout: 10_000 });

    await deleteActiveProject(page);
});

test('le permis créé apparaît dans le récapitulatif du Dashboard', async ({ page }) => {
    const projectName = `E2E PermisDash ${Date.now()}`;
    const permitName = `PC Récap ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await openPermitForm(page, permitName);
    await depositField(page).fill(DEPOSIT);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- B4.6 : le Dashboard agrège les permis de tous les projets ---
    await page.locator('#tabDashboard').click();
    /* Filtrer sur le nom du permis : la section agrège TOUS les projets du
       compte, dont ceux laissés par d'autres tests. Le total affiché dans le
       titre n'est donc pas une valeur sur laquelle s'appuyer. */
    const row = page.locator('.dashboard-permit-row').filter({ hasText: permitName });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(projectName);
    await expect(row).toContainText('Permis de construire');   // libellé du type PC
    await expect(row).toContainText('En préparation');         // statut par défaut (draft)
    await expect(row).toContainText(await displayDate(page, DEPOSIT));
    await expect(row).toContainText(await displayDate(page, DECISION_PC));

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
