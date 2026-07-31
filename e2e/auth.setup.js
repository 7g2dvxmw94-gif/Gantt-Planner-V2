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
    await expect(page.locator('#projectName')).not.toHaveText('…', { timeout: 15_000 });

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
