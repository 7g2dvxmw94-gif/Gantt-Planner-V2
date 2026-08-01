import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

const AUTH_FILE = resolve(process.cwd(), 'e2e/.auth/user.json');

setup('login', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (!email || !password) {
        throw new Error(
            'E2E_TEST_EMAIL / E2E_TEST_PASSWORD manquants. Voir .env.example.'
        );
    }

    await page.goto('auth.html');
    await page.locator('#loginEmail').fill(email);
    await page.locator('#loginPassword').fill(password);
    await page.locator('#btnLogin').click();

    await page.waitForURL(/index\.html/, { timeout: 15_000 });

    // store.initFromSupabase() (awaité par App.init()) appelle
    // purgeForeignLocalData() en tout premier, qui EFFACE
    // 'gantt_onboarding_done' tant que 'gantt_last_user_id' ne correspond pas
    // encore à ce compte (premier login sur ce storageState). Il faut donc
    // attendre la fin de l'init (marqueur data-app-ready) avant d'écrire le
    // flag, sinon la purge l'efface aussitôt et l'overlay d'onboarding
    // (même z-index que les dropdowns) intercepte les clics des tests.
    await page.locator('body[data-app-ready="true"]').waitFor({ timeout: 15_000 });
    await page.evaluate(() => localStorage.setItem('gantt_onboarding_done', '1'));

    // S'assurer qu'un projet "seed" persistant existe. Le bouton de
    // suppression de projet n'apparaît QUE si l'utilisateur a plus d'un
    // projet (js/app.js, _toggleProjectDropdown : `if (projects.length > 1)`).
    // Sans ce seed, un test qui se retrouve seul dans le compte (ex. juste
    // après un nettoyage complet) ne peut jamais supprimer son propre
    // projet de test en fin de spec — c'est exactement ce qui a cassé
    // plusieurs specs en cascade la première fois que le compte de test a
    // été entièrement nettoyé.
    const SEED_NAME = 'E2E Seed (ne pas supprimer)';
    await page.locator('.project-selector').click();
    const hasSeed = await page.locator('.project-dropdown-item .project-item-name', { hasText: SEED_NAME }).count() > 0;
    if (!hasSeed) {
        page.once('dialog', (dialog) => dialog.accept(SEED_NAME));
        await page.locator('button.new-project').click();
        await page.locator('#projectName').filter({ hasText: SEED_NAME }).waitFor({ timeout: 10_000 });
    } else {
        await page.locator('.project-selector').click(); // referme le menu
    }

    try {
        await mkdir(dirname(AUTH_FILE), { recursive: true });
        console.log(`✓ Directory created: ${dirname(AUTH_FILE)}`);
    } catch (err) {
        console.error(`✗ mkdir failed: ${err.message}`);
        throw err;
    }

    try {
        await page.context().storageState({ path: AUTH_FILE });
        console.log(`✓ Storage state saved to: ${AUTH_FILE}`);
    } catch (err) {
        console.error(`✗ storageState failed: ${err.message}`);
        throw err;
    }
});
