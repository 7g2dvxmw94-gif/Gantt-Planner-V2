import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { tableurProjet, importerTableur } from '../tableur.js';

/* Couvre TEST_PLAN.md § G5 (import Excel).
 *
 * importFromExcel() reproduit À L'IDENTIQUE les deux défauts que l'audit G4
 * a corrigés sur le chemin XML — ils n'avaient simplement jamais été
 * cherchés ici :
 *
 *   A. Aucune écriture serveur. La fonction pousse projet, tâches et
 *      ressources dans this._data, appelle _save(), et s'arrête là. Au
 *      rechargement, initFromSupabase() reconstruit l'état depuis la base
 *      et tout l'import disparaît.
 *
 *   B. Ressources orphelines. Elles sont créées sans projectId
 *      (js/store.js, « Add resources ») et le projet n'a pas de
 *      resourceIds. Or getProjectResources() parcourt resourceIds, et la
 *      portée par défaut de l'onglet Ressources est « Ce projet » : les
 *      ressources importées sont invisibles dès l'import.
 *
 * Les deux sont vérifiés par des tests SÉPARÉS, délibérément. Réunis, le
 * premier échec masquerait le second — Playwright interrompt un test à la
 * première assertion en échec, et je ne saurais pas si le défaut A mord
 * réellement.
 *
 * NOTE — le nom du PROJET vient du nom de FICHIER, et les ressources sont
 * dédoublonnées par nom à l'échelle du compte. Les deux portent donc
 * Date.now() : la CI partage un unique compte Supabase.
 */

/** Retrouve un projet par son nom via le sélecteur. Après rechargement,
 *  activeProjectId peut désigner un projet que la base ne connaît pas :
 *  l'application retombe alors silencieusement sur un autre. */
async function ouvrirProjet(page, nom) {
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nom })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nom);
}

test('import Excel : les ressources sont rattachées au projet importé', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E Excel Accueil ${suffixe}`;
    const nomXls     = `E2E Excel Res ${suffixe}`;
    const tache      = `Fondations ${suffixe}`;
    const ressource  = `Alice ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    await importerTableur(page, nomXls, tableurProjet({
        taches: [{ nom: tache, debut: '2026-11-02', fin: '2026-11-06', ressource, avancement: 10 }],
    }));

    /* Le chargement de SheetJS depuis son CDN précède l'import : d'où un
       délai plus généreux que sur les autres chemins. */
    await expect(page.locator('#toastContainer .toast', { hasText: nomXls }))
        .toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXls);
    await trackActiveProject(page);

    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: tache }))
        .toBeVisible({ timeout: 10_000 });

    // Portée « Ce projet », celle par défaut : la ressource doit y figurer.
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: ressource }))
        .toBeVisible({ timeout: 10_000 });

    // --- Nettoyage ---
    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
    await ouvrirProjet(page, nomAccueil);
    await page.locator('#tabResources').click();
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.resource-card', { hasText: ressource })
        .locator('.resource-action-delete').click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(0);
    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});

test('import Excel : le projet importé survit à un rechargement', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E Excel Persist Accueil ${suffixe}`;
    const nomXls     = `E2E Excel Persist ${suffixe}`;
    const phase      = `Gros oeuvre ${suffixe}`;
    const tache1     = `Fondations ${suffixe}`;
    const tache2     = `Elevation ${suffixe}`;
    const ressource  = `Bob ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    /* Deux lignes sous une même phase : l'import fabrique la phase à la
       volée et lui calcule ses dates à partir de ses enfants. Le
       rechargement doit retrouver l'arborescence, pas seulement les tâches. */
    await importerTableur(page, nomXls, tableurProjet({
        taches: [
            { nom: tache1, debut: '2026-11-02', fin: '2026-11-06', phase, ressource, avancement: 10 },
            { nom: tache2, debut: '2026-11-09', fin: '2026-11-13', phase, ressource, avancement: 0 },
        ],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXls }))
        .toBeVisible({ timeout: 20_000 });
    await trackActiveProject(page);
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: tache1 }))
        .toBeVisible({ timeout: 10_000 });

    /* --- L'assertion centrale : recharger ---
       Volontairement dépourvue d'assertion sur les ressources : le défaut B
       la ferait tomber la première et masquerait celui-ci. Ce test ne parle
       que de la persistance. */
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomXls);

    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: tache1 }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: tache2 }))
        .toBeVisible();

    // La phase fabriquée à l'import, et le rattachement de ses enfants.
    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: tache2 }).dblclick();
    await expect(page.locator('#taskParent option:checked')).toHaveText(phase, { timeout: 10_000 });
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    // --- Nettoyage ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomAccueil);
    await page.locator('#tabResources').click();
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.resource-card', { hasText: ressource })
        .locator('.resource-action-delete').click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(0);
    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
