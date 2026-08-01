import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G2 (export CSV) : vérifie que le fichier
   téléchargé contient réellement les en-têtes et les tâches du projet,
   pas seulement qu'un téléchargement démarre. */

test('exporter en CSV télécharge un fichier contenant les tâches du projet', async ({ page }) => {
    const projectName = `E2E CSV ${Date.now()}`;
    const taskName = `Tache export csv ${Date.now()}`;

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
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^CSV$/ }) })
        .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const filePath = await download.path();
    // L'export encode chaque caractère sur un octet (charCodeAt & 0xFF,
    // annoncé Windows-1252) : le lire en utf-8 romprait les accents des
    // en-têtes ("Durée"...). 'latin1' reconstruit fidèlement des octets
    // < 256 générés ainsi.
    const content = await fs.readFile(filePath, 'latin1');
    const [header, ...rows] = content.split('\n');

    expect(header.split(';')).toEqual(['Niveau hiérarchique', 'Nom', 'Durée', 'Début', 'Fin', 'Noms ressources', '% achevé']);
    expect(rows.some(r => r.includes(taskName))).toBe(true);
    expect(content).toContain('10/08/2026');
    expect(content).toContain('12/08/2026');

    await deleteActiveProject(page);
});
