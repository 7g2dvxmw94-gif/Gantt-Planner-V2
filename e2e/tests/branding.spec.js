import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';
import { snapshotCustomization } from '../cleanup.js';

/* Couvre TEST_PLAN.md § I1 (couleurs) et § I2 (identité). La personnalisation
   est un réglage global du compte (pas propre à un projet) : comme
   theme.spec.js, on capture l'état initial et on le restaure en fin de
   test plutôt que de supposer une valeur par défaut, pour ne pas altérer
   durablement le compte de test partagé.

   Ces deux tests restaurent eux-mêmes l'état de départ par leur dernière
   instruction — donc jamais s'ils échouent avant. La capture ci-dessous
   confie la même restauration au filet de nettoyage (cleanup.js), qui lui
   s'exécute quoi qu'il arrive au test. À la différence du thème, la
   personnalisation est écrite dans Supabase : elle survivrait au run. */

test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
    await snapshotCustomization(page);
});

test('changer la couleur d’accent l’applique immédiatement et la persiste après rechargement', async ({ page }) => {
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
        /* Le toast n'est emis qu'une fois les ecritures Supabase terminees
           (settings-panel.js, _save() attend _flushPendingWrites()) : c'est
           donc le signal fiable que la personnalisation est bien persistee.
           Sans cette attente, le page.reload() ci-dessous pouvait partir
           avant la fin de l'ecriture et repartir de l'etat serveur
           precedent — la couleur revenait alors au defaut. */
        await page.locator('#toastContainer .toast', { hasText: 'Réglages enregistrés' })
            .waitFor({ timeout: 10_000 });
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

test('changer le nom de l’entreprise l’affiche à côté du logo et persiste après rechargement', async ({ page }) => {
    const nameField = page.locator('#settingsName');
    const logoText = page.locator('.logo > span');
    const targetName = `E2E Brand ${Date.now()}`;

    const setCompanyName = async (name) => {
        await nameField.fill(name);
        await expect(nameField).toHaveValue(name);
        /* La sauvegarde est debouncée 500 ms sur 'input' (settings-panel.js).
           _applyBrandName() est appelé DANS ce gestionnaire, juste après
           _saveCustomization() : voir le logo refléter la nouvelle valeur
           prouve donc que le debounce a tourné et que l'écriture est lancée.
           C'est un signal observable, là où le waitForTimeout(600) qui
           figurait ici pariait sur une durée. */
        if (name.trim()) {
            await expect(logoText).toHaveText(name.trim());
        } else {
            await expect(logoText).toHaveCount(0);
        }
        await page.locator('#settingsSaveBtn').click();
        // Puis attendre la fin de l'écriture réseau elle-même (cf. premier test).
        await page.locator('#toastContainer .toast', { hasText: 'Réglages enregistrés' })
            .waitFor({ timeout: 10_000 });
    };

    await page.locator('#settingsBtn').click();
    const initialCompanyValue = await nameField.inputValue();

    await setCompanyName(targetName);

    await page.reload();
    await waitForAppReady(page);
    await expect(logoText).toHaveText(targetName);

    await page.locator('#settingsBtn').click();
    await expect(nameField).toHaveValue(targetName);
    await setCompanyName(initialCompanyValue);
});
