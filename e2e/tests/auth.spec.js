import { test, expect } from '@playwright/test';

/* Ces deux scénarios doivent tourner SANS session existante : on écrase le
   storageState hérité du projet "chromium" (issu de auth.setup.js). */
test.use({ storageState: { cookies: [], origins: [] } });

test('un visiteur non connecté est redirigé vers la page de connexion', async ({ page }) => {
    // waitUntil: 'commit' — index.html redirige côté client avant l'évènement
    // "load", ce qui bloquerait un goto() en attente de "load" indéfiniment.
    await page.goto('index.html', { waitUntil: 'commit' });
    await page.waitForURL(/auth\.html/, { timeout: 10_000 });
});

test('un mot de passe invalide affiche une erreur et ne redirige pas', async ({ page }) => {
    await page.goto('auth.html');
    await page.locator('#loginEmail').fill(process.env.E2E_TEST_EMAIL || 'inconnu@example.com');
    await page.locator('#loginPassword').fill('mot-de-passe-totalement-faux');
    await page.locator('#btnLogin').click();

    await expect(page.locator('#alertBox')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/auth\.html/);
});
