import { test, expect } from '@playwright/test';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § A1 (créer un projet) et § A2 (basculer entre projets). */

test('créer un projet puis basculer entre deux projets', async ({ page }) => {
    await page.goto('index.html');

    const nameA = `E2E Project A ${Date.now()}`;
    const nameB = `E2E Project B ${Date.now()}`;

    await createProject(page, nameA);
    await createProject(page, nameB);

    // Le projet B (créé en dernier) doit être actif.
    await expect(page.locator('#projectName')).toHaveText(nameB);

    // Basculer vers A via le sélecteur.
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nameA }).click();
    await expect(page.locator('#projectName')).toHaveText(nameA);

    // Nettoyage : supprimer les deux projets créés par ce test.
    await deleteActiveProject(page); // supprime A (actif)
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nameB }).click();
    await deleteActiveProject(page); // supprime B
});

test('renommer le projet actif', async ({ page }) => {
    // Diagnostic temporaire : ce test flake par intermittence — l'input de
    // renommage apparaît puis se fait détacher du DOM pendant le fill()
    // (retries répétés jusqu'au timeout). Instrumentation pour observer la
    // séquence exacte de mutations DOM et d'événements focus/blur.
    page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[browser:pageerror] ${err.message}`));

    await page.goto('index.html');

    const original = `E2E Rename Src ${Date.now()}`;
    const renamed = `E2E Rename Dst ${Date.now()}`;
    await createProject(page, original);

    await page.evaluate(() => {
        const log = (msg) => console.log(`[diag] ${performance.now().toFixed(1)}ms ${msg}`);
        const attachInputWatchers = (input) => {
            log('rename input attached, wiring focus/blur watchers');
            input.addEventListener('focus', () => log('input focus'));
            input.addEventListener('blur', () => log('input blur'));
        };
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((n) => {
                    if (n.nodeType !== 1) return;
                    if (n.id === 'projectDropdown') log('projectDropdown ADDED');
                    if (n.classList?.contains('project-rename-input')) attachInputWatchers(n);
                    n.querySelectorAll?.('.project-rename-input').forEach(attachInputWatchers);
                });
                m.removedNodes.forEach((n) => {
                    if (n.nodeType !== 1) return;
                    if (n.id === 'projectDropdown') log('projectDropdown REMOVED');
                    if (n.classList?.contains('project-rename-input')) log('rename input REMOVED (direct)');
                    if (n.querySelector?.('.project-rename-input')) log('rename input REMOVED (ancestor removed): ' + n.className);
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.__renameDiagObserver = observer;
    });

    await page.locator('.project-selector').click();

    // Find the project item and its rename button
    const projectItem = page.locator('.project-dropdown-item', { hasText: original }).first();
    const actionBtn = projectItem.locator('.project-item-action');

    // Ensure the button is visible before clicking
    await actionBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await actionBtn.click();

    // After clicking the action button, the input should appear
    const renameInput = page.locator('.project-rename-input');
    await renameInput.waitFor({ state: 'visible', timeout: 5_000 });
    await renameInput.fill(renamed);
    await renameInput.press('Enter');

    await expect(page.locator('#projectName')).toHaveText(renamed);

    await deleteActiveProject(page);
});
