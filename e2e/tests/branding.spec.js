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

    // <input type="color"> normalise toujours sa valeur en hex minuscule dès
    // qu'elle transite par lui (y compris pour restaurer la couleur
    // initiale) : comparer en minuscules partout évite un faux échec sur la
    // casse (ex. le préréglage par défaut "#6366F1" vs sa forme normalisée
    // "#6366f1").
    const getPrimaryColor = () => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim().toLowerCase()
    );

    const setAccentColor = async (hex) => {
        await page.locator('#settingsBtn').click();
        await page.locator('.settings-tab[data-tab="apparence"]').click();
        // Le sélecteur de couleur personnalisée permet de restaurer
        // n'importe quelle valeur initiale (y compris une couleur déjà
        // personnalisée), contrairement aux pastilles prédéfinies.
        await page.locator('#settingsAccentColor').evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, hex);
        await expect.poll(getPrimaryColor).toBe(hex);
        await page.locator('#settingsSaveBtn').click();
    };

    const initialColor = await getPrimaryColor();
    const targetColor = initialColor === '#8b5cf6' ? '#6366f1' : '#8b5cf6';

    await setAccentColor(targetColor);
    await expect.poll(getPrimaryColor).toBe(targetColor);

    await page.reload();
    await waitForAppReady(page);
    await expect.poll(getPrimaryColor).toBe(targetColor);

    await setAccentColor(initialColor);
    await expect.poll(getPrimaryColor).toBe(initialColor);
});

test('changer le nom de l’entreprise dans Réglages > Profil persiste après rechargement', async ({ page }) => {
    // Note : _applyBrandName() (settings-panel.js) ne cible que
    // '.logo > span', un élément qu'aucun code ne crée jamais — le logo
    // d'en-tête est en réalité une image PNG (.logo-icon), pas du texte.
    // Ce champ n'a donc actuellement aucun effet visuel dans l'en-tête ;
    // seule sa persistance (valeur enregistrée) est vérifiable ici.
    await page.goto('index.html');
    await waitForAppReady(page);

    const nameField = page.locator('#settingsName');
    const targetName = `E2E Brand ${Date.now()}`;

    const setCompanyName = async (name) => {
        await nameField.fill(name);
        await expect(nameField).toHaveValue(name);
        // La sauvegarde vers le store (et sa synchro Supabase) est debattue
        // sur l'événement 'input' avec 500ms de délai (settings-panel.js
        // _debounce) ; contrairement au changement de couleur, rien d'autre
        // n'attend naturellement ce délai avant le rechargement de page.
        await page.waitForTimeout(600);
        await page.locator('#settingsSaveBtn').click();
    };

    await page.locator('#settingsBtn').click();
    const initialCompanyValue = await nameField.inputValue();

    await setCompanyName(targetName);

    await page.reload();
    await waitForAppReady(page);
    await page.locator('#settingsBtn').click();
    await expect(nameField).toHaveValue(targetName);

    await setCompanyName(initialCompanyValue);
});
