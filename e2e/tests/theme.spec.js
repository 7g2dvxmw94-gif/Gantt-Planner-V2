import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § J1 (bascule manuelle du thème via Ctrl+D).
   Ne suppose pas un thème de départ précis (le compte de test partagé
   peut avoir laissé un thème sombre d'un run précédent) : bascule vers
   l'opposé de l'état courant, puis revient.

   Rien à confier au filet de nettoyage (cleanup.js) ici : à la différence
   de la personnalisation, store.updateSettings() n'envoie PAS le thème à
   Supabase (seule la clé `customization` y est synchronisée). Il ne vit
   donc que dans le localStorage du contexte navigateur, reconstruit à
   chaque test depuis le storageState figé par auth.setup.js — un thème
   laissé basculé ne franchit pas la frontière du test. */

test('Ctrl+D bascule le thème puis revient au thème initial', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    const otherTheme = initialTheme === 'dark' ? 'light' : 'dark';

    await page.keyboard.press('Control+d');
    await expect(html).toHaveAttribute('data-theme', otherTheme);

    await page.keyboard.press('Control+d');
    await expect(html).toHaveAttribute('data-theme', initialTheme);
});
