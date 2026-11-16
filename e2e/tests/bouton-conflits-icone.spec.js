import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1 (barre d'outils) : le bouton des conflits de
 * contraintes garde son icône quand les libellés sont masqués.
 *
 * LE DÉFAUT. Sous 2 200 px, `.toolbar-actions .btn-secondary span` est
 * masqué (css/responsive.css) : la règle vise les LIBELLÉS, relayés par
 * le nom et l'infobulle (#141). Mais #conflitsBtn porte aussi son icône
 * dans un span, `<span aria-hidden="true">⚠</span>` : la même règle la
 * masque, et le bouton devient une pastille vide. Il garde son nom et son
 * infobulle, plus rien de visible ne dit ce qu'il est. Même chose sous
 * 1 200 px (`.btn span`). Forme : « un invariant énoncé quelque part et
 * démenti ailleurs » — la règle dit « libellé », elle touche une icône.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : l'icône masquée à 2 000 px. Les discriminants passent. */

test('le bouton des conflits garde son icône « ⚠ » quand les libellés sont masqués', async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    /* Le bouton n'apparaît qu'avec des conflits : on l'affiche comme le
       fait _majConflitsBtn, avec un texte. */
    await page.evaluate(() => {
        const b = document.getElementById('conflitsBtn');
        b.hidden = false;
        b.querySelector('.conflits-btn-texte').textContent = '12 conflits';
    });
    const bouton = page.locator('#conflitsBtn');
    const icone = bouton.locator('span[aria-hidden="true"]');

    for (const largeur of [2000, 1100]) {
        await page.setViewportSize({ width: largeur, height: 800 });
        /* DISCRIMINANTS — le bouton est affiché, son icône est bien « ⚠ »,
           et les libellés SONT masqués à cette largeur : celui
           d'« Exporter », et le texte du bouton lui-même. Ferme « la règle
           ne s'applique pas ici, le test ne mesure rien ». */
        await expect(bouton, `bouton affiché à ${largeur} px`).toBeVisible();
        await expect(icone, 'l\'icône du bouton').toHaveText('⚠');
        await expect(page.locator('#exportBtn span[data-i18n]'), `libellé d'« Exporter » masqué à ${largeur} px`).toBeHidden();
        await expect(bouton.locator('.conflits-btn-texte'), `texte du bouton masqué à ${largeur} px`).toBeHidden();

        // --- L'ASSERTION CENTRALE ---
        await expect(icone, `icône « ⚠ » visible à ${largeur} px`).toBeVisible();
    }
});
