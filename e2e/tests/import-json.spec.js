import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § G1 étape 5 (import) : le fichier JSON exporté
   doit pouvoir être réimporté et restaurer un projet identique (mêmes
   tâches). Round-trip réel : export puis réimport du même fichier
   téléchargé, plutôt qu'une fixture statique. */

test('réimporter un export JSON restaure un projet identique', async ({ page }) => {
    const projectName = `E2E Import ${Date.now()}`;
    const taskName = `Tâche import ${Date.now()}`;

    // Diagnostic temporaire : la synchro Supabase du projet original semble
    // ne jamais atteindre le serveur (confirmé par requête SQL directe),
    // sans qu'aucune erreur ne remonte dans les logs CI habituels — capturer
    // la console du navigateur pour voir l'erreur réelle, le cas échéant.
    page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[browser:pageerror] ${err.message}`));

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Exporter en JSON.
    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^JSON$/ }) })
        .click();
    const download = await downloadPromise;
    const filePath = await download.path();

    // Réimporter ce même fichier : store.importProject() crée un NOUVEAU
    // projet (nouveaux ids, tâches remappées) et l'active automatiquement.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    await expect(page.locator('#toastContainer .toast', { hasText: `"${projectName}"` })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(projectName);
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName })).toBeVisible({ timeout: 10_000 });

    // Nettoyage : deux projets partagent désormais le même nom (l'original
    // et la copie importée, active) — supprimer l'un puis l'autre. Un
    // rechargement entre les deux repart d'un DOM propre avant de rouvrir
    // le sélecteur de projet.
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});
