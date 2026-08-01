import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § I1 (couleurs) et § I2 (identité). La personnalisation
   est un réglage global du compte (pas propre à un projet) : comme
   theme.spec.js, on capture l'état initial et on le restaure en fin de
   test plutôt que de supposer une valeur par défaut, pour ne pas altérer
   durablement le compte de test partagé. */

test('changer la couleur d’accent l’applique immédiatement et la persiste après rechargement', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const getPrimaryColor = () => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
    );

    const setAccentColor = async (hex) => {
        await page.locator('#settingsBtn').click();
        await page.locator('.settings-tab[data-tab="apparence"]').click();
        // Le sélecteur de couleur personnalisée normalise toujours en hex
        // minuscule et permet de restaurer n'importe quelle valeur initiale
        // (y compris une couleur déjà personnalisée), contrairement aux
        // pastilles de couleurs prédéfinies.
        await page.locator('#settingsAccentColor').evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, hex);
        await expect.poll(getPrimaryColor).toBe(hex);
        await page.locator('#settingsSaveBtn').click();
    };

    const initialColor = await getPrimaryColor();
    const targetColor = initialColor.toLowerCase() === '#8b5cf6' ? '#6366f1' : '#8b5cf6';

    await setAccentColor(targetColor);
    await expect.poll(getPrimaryColor).toBe(targetColor);

    await page.reload();
    await waitForAppReady(page);
    await expect.poll(getPrimaryColor).toBe(targetColor);

    await setAccentColor(initialColor);
    await expect.poll(getPrimaryColor).toBe(initialColor);
});

test('changer le nom de l’entreprise met à jour le logo et persiste après rechargement', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const logoText = page.locator('.logo > span');
    const targetName = `E2E Brand ${Date.now()}`;

    const setCompanyName = async (name) => {
        await page.locator('#settingsName').fill(name);
        await expect(logoText).toHaveText(name.trim() ? name.trim() : 'Gantly');
        await page.locator('#settingsSaveBtn').click();
    };

    await page.locator('#settingsBtn').click();
    const initialCompanyValue = await page.locator('#settingsName').inputValue();

    await setCompanyName(targetName);
    await expect(logoText).toHaveText(targetName);

    await page.reload();
    await waitForAppReady(page);
    await expect(logoText).toHaveText(targetName);

    await page.locator('#settingsBtn').click();
    await setCompanyName(initialCompanyValue);
});
