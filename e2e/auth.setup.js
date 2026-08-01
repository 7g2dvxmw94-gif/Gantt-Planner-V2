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
    //
    // IMPORTANT : ce nom ne doit PAS commencer par "E2E " — un nettoyage
    // manuel ponctuel des projets de test orphelins (`name like 'E2E %'`)
    // a supprimé ce seed par erreur la première fois, exactement parce
    // qu'il correspondait à ce même motif.
    const SEED_NAME = '🔒 Seed persistant (ne pas supprimer)';
    page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[browser:pageerror] ${err.message}`));
    page.on('dialog', (dialog) => console.log(`[dialog] type=${dialog.type()} message=${dialog.message()}`));

    await page.locator('.project-selector').click();
    const dropdownVisible = await page.locator('#projectDropdown').isVisible().catch(() => false);
    const itemCount = await page.locator('.project-dropdown-item[data-project-id]').count();
    const hasSeed = await page.locator('.project-dropdown-item .project-item-name', { hasText: SEED_NAME }).count() > 0;
    console.log(`[seed] dropdownVisible=${dropdownVisible} itemCount=${itemCount} hasSeed=${hasSeed}`);
    if (!hasSeed) {
        page.once('dialog', (dialog) => dialog.accept(SEED_NAME));
        await page.locator('button.new-project').click();
        await page.locator('#projectName').filter({ hasText: SEED_NAME }).waitFor({ timeout: 10_000 });
        // store.addProject() attend maintenant la synchro Supabase avant de
        // rendre la main ; ce toast ne s'affiche qu'une fois le projet
        // réellement persisté côté serveur — condition nécessaire puisque le
        // contexte du navigateur se ferme juste après (storageState() puis
        // fin du test setup), sans quoi la requête réseau pouvait être
        // coupée avant de partir (même anti-pattern que deleteProject).
        await page.locator('#toastContainer .toast', { hasText: `"${SEED_NAME}" créé` }).waitFor({ timeout: 10_000 });
        console.log('[seed] created successfully');
    } else {
        await page.locator('.project-selector').click(); // referme le menu
        console.log('[seed] already existed');
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
