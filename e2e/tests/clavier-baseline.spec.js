import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § AC1, volets 1 et 3 — « Tab traverse tous les
 * contrôles » et « Entrée sur bouton : action déclenchée ».
 *
 * LE DÉFAUT : choisir une baseline de référence est impossible au clavier.
 *
 * La ligne du popover est un <div> porteur d'un gestionnaire de clic, sans
 * tabindex, sans role, et sans gestionnaire clavier :
 *
 *     const item = document.createElement('div');
 *     item.className = 'bl-pop-item' + …;
 *     item.addEventListener('click', async (e) => { … });
 *
 * Elle n'est donc ni atteignable par Tab, ni activable par Entrée.
 *
 * LE CHEMIN CLAVIER A ÉTÉ FERMÉ DES DEUX CÔTÉS. La ligne contient un
 * bouton radio — un vrai <button>, focalisable par nature — mais il en est
 * explicitement retiré :
 *
 *     radio.tabIndex = -1; // item row handles activation
 *
 * Le commentaire dit l'intention : c'est la LIGNE qui prend en charge
 * l'activation. Le bouton a bien été sorti de l'ordre de tabulation ; la
 * ligne n'y a jamais été mise. Même forme qu'en #46, où un commentaire
 * affirmait un invariant que le code violait.
 *
 * DEUX EXIGENCES DISTINCTES, donc deux assertions : un élément interactif
 * doit être ATTEIGNABLE (focalisable) et OPÉRABLE (activable au clavier).
 * Un tabindex sans gestionnaire de touches satisferait la première sans la
 * seconde.
 */

const popover = '#baselinePopover';

async function ouvrirPopover(page) {
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeVisible({ timeout: 10_000 });
}

async function creerTache(page, nom) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill('2026-09-07');
    await page.locator('#taskEnd').fill('2026-09-09');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom }))
        .toBeVisible({ timeout: 10_000 });
}

async function creerBaseline(page, nom) {
    await page.locator('.bl-create-input').fill(nom);
    await page.locator('.bl-create-btn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: nom }))
        .toBeVisible({ timeout: 10_000 });
    const ligne = page.locator('.bl-pop-item').filter({ hasText: nom });
    await expect(ligne).toBeVisible({ timeout: 10_000 });
    return ligne;
}

test('choisir une baseline est possible au clavier', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E ClavierBaseline ${suffixe}`;
    const nomTache  = `Tâche de référence ${suffixe}`;
    const nomA      = `Référence A ${suffixe}`;
    const nomB      = `Référence B ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomTache);

    await ouvrirPopover(page);
    const ligneA = await creerBaseline(page, nomA);
    // La seconde création auto-active B, ce qui laisse A inactive.
    const ligneB = await creerBaseline(page, nomB);
    await expect(ligneB).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneA).not.toHaveClass(/bl-pop-item--active/);

    /* DISCRIMINANT — À LA SOURIS, LA LIGNE FONCTIONNE. On active A, puis on
       revient à B pour restaurer l'état de départ. Cela établit que la
       ligne est bien l'élément qui commande l'activation, et cantonne le
       défaut au chemin CLAVIER : sans cette vérification, un échec plus bas
       pourrait signifier que la ligne n'active rien du tout. */
    await ligneA.click();
    await expect(ligneA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await ligneB.click();
    await expect(ligneB).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneA).not.toHaveClass(/bl-pop-item--active/);

    /* --- PREMIÈRE ASSERTION CENTRALE : ATTEIGNABLE ---
       Un <div> sans tabindex ne prend pas le focus : l'appel reste sans
       effet et le focus demeure ailleurs. C'est le volet 1 du § AC1, « Tab
       traverse tous les contrôles ». */
    await ligneA.focus();
    await expect(ligneA).toBeFocused();

    /* --- SECONDE ASSERTION CENTRALE : OPÉRABLE ---
       Volet 3, « Entrée sur bouton : action déclenchée ». Distincte de la
       première : un tabindex posé sans gestionnaire de touches rendrait la
       ligne focalisable mais toujours inerte. */
    await page.keyboard.press('Enter');
    await expect(ligneA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneB).not.toHaveClass(/bl-pop-item--active/);

    /* Refermer par le bouton : Échap ne ferme pas ce popover, et un popover
       resté ouvert intercepterait le clic du sélecteur de projet au
       nettoyage. */
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeHidden();

    await deleteActiveProject(page);
});
