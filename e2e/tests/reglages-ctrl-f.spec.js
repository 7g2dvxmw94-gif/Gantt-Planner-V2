import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourci Ctrl+F) là où il croise § E
 * (réglages) : ce que le raccourci fait quand le panneau de réglages est
 * ouvert.
 *
 * LE DÉFAUT : Ctrl+F fait sortir le focus du panneau de réglages.
 *
 * Le garde-fou existe depuis #64. Le gestionnaire de Ctrl+F d'app.js
 * renonce à déplacer le focus quand une fenêtre modale est ouverte :
 *
 *     if (modaleOuverte()) return;
 *
 * et modaleOuverte() pose la question aux éléments qui se déclarent
 * EUX-MÊMES modaux, par `[aria-modal="true"]`. Or le panneau de réglages
 * porte `role="dialog"` mais PAS `aria-modal` : le garde-fou ne le voit
 * pas, et Ctrl+F envoie le focus sur #searchInput — dans l'en-tête,
 * DERRIÈRE le voile.
 *
 * TROUVÉ EN #78, NON TRAITÉ LÀ, ET LIÉ À #77. #77 a posé un piège à Tab
 * dans ce panneau sans voir que Ctrl+F en sortait par une autre porte :
 * le piège de Tab écoute `document`, le gestionnaire de Ctrl+F intercepte
 * sur `window` en phase de CAPTURE, donc plus tôt. Le piège ne peut rien
 * y faire ; seul le garde-fou le peut, et il lui faut une déclaration.
 *
 * LE CORRECTIF ÉVIDENT EST FAUX, ET LE SECOND TEST EXISTE POUR L'INTERDIRE.
 * Le panneau fermé est masqué par `transform: translateX(100%)` : hors
 * écran, mais ni `display: none` ni `visibility: hidden`. Pour
 * checkVisibility(), il reste donc VISIBLE MÊME FERMÉ. Poser
 * `aria-modal="true"` à demeure — au moment de construire le panneau —
 * ferait croire au garde-fou qu'une modale est ouverte en permanence :
 * Ctrl+F ne marcherait plus jamais. L'attribut doit suivre l'ouverture.
 *
 * Le second test passe donc AVANT comme APRÈS un correctif juste, et
 * n'échoue que sous le correctif naïf. Le rouge attendu pour ce commit de
 * test est UN SEUL échec — le premier test —, pas deux.
 *
 * sauvegarde-drive-focus.spec.js garde aussi cette porte, par un autre
 * côté : le piège générique de #78 prend la PREMIÈRE modale visible du
 * document, et s'efface devant le panneau de réglages qui a son propre
 * piège. Un panneau déclaré modal en permanence, construit à
 * l'initialisation donc avant la fenêtre Drive, serait trouvé en premier
 * — et le piège de la fenêtre Drive cesserait de fonctionner.
 */

async function ouvrirReglages(page) {
    await page.goto('index.html');
    await waitForAppReady(page);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('.settings-panel.open')).toBeVisible({ timeout: 10_000 });
}

test('Ctrl+F ne fait pas sortir le focus du panneau de réglages', async ({ page }) => {
    await ouvrirReglages(page);

    /* DISCRIMINANT — LE FOCUS EST DANS LE PANNEAU AVANT LA FRAPPE.
       open() le pose sur #settingsPanelClose après 100 ms. C'est l'état
       de départ à partir duquel l'assertion centrale mesure un
       déplacement : sans lui, « le focus n'est pas dans le panneau » ne
       dirait pas si Ctrl+F l'en a fait sortir ou s'il n'y était jamais
       entré. Passe avant comme après le correctif. */
    await expect.poll(
        () => page.evaluate(() => document.activeElement && document.activeElement.id),
        { timeout: 10_000 },
    ).toBe('settingsPanelClose');

    await page.keyboard.press('Control+f');

    /* --- L'ASSERTION CENTRALE ---
       Le focus doit rester dans le panneau. Le message nomme l'élément
       où il est parti : tant que le défaut tient, ce sera #searchInput,
       ce qui confirme le mécanisme et pas seulement le symptôme. */
    const etat = await page.evaluate(() => ({
        dedans: !!document.activeElement && !!document.activeElement.closest('.settings-panel'),
        id: document.activeElement ? document.activeElement.id : null,
    }));
    expect(etat.dedans, `focus parti sur #${etat.id}`).toBe(true);
});

test('après fermeture des réglages, Ctrl+F retrouve la recherche', async ({ page }) => {
    await ouvrirReglages(page);

    // Fermeture par Échap, le chemin clavier : _cancel() puis close().
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings-panel.open')).toHaveCount(0, { timeout: 10_000 });

    /* DISCRIMINANT — LE FOCUS N'EST PAS DÉJÀ SUR LA RECHERCHE.
       close() le rend à #settingsBtn. Sans ce point, l'assertion centrale
       serait vraie même si le raccourci ne faisait rien. */
    await expect(page.locator('#searchInput')).not.toBeFocused();

    await page.keyboard.press('Control+f');

    /* --- L'ASSERTION CENTRALE ---
       Un panneau FERMÉ n'est pas une modale. Si la déclaration survivait
       à la fermeture, le garde-fou croirait une fenêtre ouverte et
       confisquerait le raccourci pour toujours. */
    await expect(page.locator('#searchInput')).toBeFocused();
});
