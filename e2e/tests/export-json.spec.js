import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G1 (export JSON) : vérifie que le fichier
   téléchargé est un JSON valide contenant réellement les données du
   projet actif, pas seulement qu'un téléchargement démarre. */

test('exporter en JSON télécharge un fichier contenant les données du projet', async ({ page }) => {
    const projectName = `E2E Export ${Date.now()}`;
    const taskName = `Tâche export ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    // Cibler le libellé exact "JSON" : la description de "Tout exporter"
    // contient aussi le mot "JSON" ("Tous les projets (JSON)"), un simple
    // hasText sur l'item entier matcherait les deux boutons.
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^JSON$/ }) })
        .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const filePath = await download.path();
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    expect(content.project.name).toBe(projectName);
    expect(content.tasks.some(t => t.name === taskName)).toBe(true);

    await deleteActiveProject(page);
});
