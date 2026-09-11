import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourci Ctrl+F) là où il croise § AC1
 * (navigation au clavier) et § AC2.5 (annonce des modales) : ce que le
 * raccourci fait quand une fenêtre modale est ouverte.
 *
 * LE DÉFAUT : Ctrl+F sort le focus d'une fenêtre modale.
 *
 *     // js/app.js — gestionnaire posé en phase de CAPTURE sur window
 *     if (mod && e.key === 'f') {
 *         const searchInput = $('#searchInput');
 *         if (searchInput) {
 *             _prevent(e);
 *             searchInput.focus();
 *         }
 *     }
 *
 * `#searchInput` est le champ de recherche de l'en-tête, DERRIÈRE la
 * modale et sous son voile. Le raccourci y envoie le focus sans jamais
 * demander si une modale est ouverte.
 *
 * L'INVARIANT EST ÉNONCÉ DEUX FOIS, À DEUX ENDROITS, DANS LE MÊME FICHIER
 * — et c'est ce qui rend le verdict objectif plutôt qu'affaire de goût :
 *
 *   1. js/task-modal.js pose `role="dialog"` et `aria-modal="true"` sur la
 *      fenêtre. C'est une promesse faite aux technologies d'assistance :
 *      tout ce qui est en dehors de ce conteneur est indisponible.
 *   2. js/task-modal.js implémente un PIÈGE À FOCUS explicite (commenté
 *      « Focus trap ») qui, sur Tab, ramène le focus du dernier contrôle
 *      au premier et inversement.
 *
 * L'application dit donc noir sur blanc que le focus ne doit pas quitter
 * cette fenêtre — puis un autre fichier l'en fait sortir. Le piège ne peut
 * rien y voir : il écoute `document` et ne traite que Tab, tandis que
 * Ctrl+F est intercepté sur `window` en phase de CAPTURE, donc plus tôt.
 *
 * CONSÉQUENCE, ET ELLE EST DOUBLE. Le focus atterrit sur un champ masqué
 * par le voile : l'utilisateur au clavier ne voit plus où il est, et sa
 * frappe suivante part dans un champ qu'il ne regarde pas. Et comme
 * `_prevent(e)` appelle `preventDefault()`, la recherche native du
 * navigateur est supprimée en même temps : la touche est confisquée sans
 * rien rendre en échange.
 *
 * CE QUE CE TEST NE JUGE PAS. Hors modale, Ctrl+F depuis un champ de
 * saisie déplace aussi le focus vers la recherche. C'est discutable, mais
 * discutable est le mot juste : le raccourci est annoncé comme global
 * jusque dans le placeholder du champ (« Rechercher... (Ctrl/⌘+F) »), et
 * aucun invariant du code ne tranche. Aucun rouge ne peut arbitrer un
 * choix d'interface : ce cas est laissé tel quel, délibérément.
 */

test('Ctrl+F ne fait pas sortir le focus d\'une fenêtre modale', async ({ page }) => {
    const nomProjet = `E2E FocusModale ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    await page.locator('#addTaskBtn').click();

    /* PREMIER DISCRIMINANT — LA MODALE EST BIEN OUVERTE. Sans lui, un
       focus resté sur le corps du document pourrait vouloir dire que la
       modale ne s'est jamais affichée, et non que le raccourci l'a
       respectée. */
    await expect(page.locator('#taskModalOverlay')).toBeVisible({ timeout: 15_000 });

    /* SECOND DISCRIMINANT — LE FOCUS EST DANS LA MODALE AVANT LA FRAPPE.
       openCreate() termine par `this._taskName.focus()`. C'est l'état de
       départ à partir duquel l'assertion centrale mesure un déplacement :
       sans lui, « le focus n'est pas dans la modale » ne dirait pas si
       Ctrl+F l'a fait sortir ou s'il n'y était jamais entré. */
    await expect(page.locator('#taskName')).toBeFocused({ timeout: 10_000 });

    await page.keyboard.press('Control+f');

    /* --- L'ASSERTION CENTRALE ---
       Le champ de recherche de l'en-tête est derrière le voile de la
       modale. Rien ne doit pouvoir y amener le focus tant que la fenêtre
       est ouverte : c'est exactement ce que `aria-modal="true"` promet et
       ce que le piège à focus fait respecter à Tab. */
    await expect(page.locator('#searchInput')).not.toBeFocused();

    /* Le revers de la même mesure : le focus n'a pas seulement évité la
       recherche, il est resté où il était. Une frappe qui l'aurait envoyé
       sur le corps du document satisferait la première assertion tout en
       cassant la navigation au clavier. */
    await expect(page.locator('#taskName')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 10_000 });
    await deleteActiveProject(page);
});

/* CE SECOND TEST N'EST PAS UN ROUGE — il passe avant comme après le
 * correctif, et c'est exactement ce qu'on lui demande.
 *
 * Le correctif consiste à poser une condition devant Ctrl+F. Une condition
 * peut se tromper dans les deux sens : ne pas se déclencher quand il
 * faudrait — le test ci-dessus le dirait — ou se déclencher toujours, et
 * alors le raccourci ne fonctionnerait plus du tout. Cette seconde panne
 * est silencieuse : aucun test n'existait pour Ctrl+F avant ce fichier, et
 * le premier test ci-dessus serait vert dans ce cas aussi.
 *
 * Ce test ferme cette porte. Verrouillant § K1 (« Ctrl+F → barre de
 * recherche ouverte »), il mesure la LARGEUR du correctif, là où le test
 * précédent en mesure l'EFFET.
 */
test('Ctrl+F donne le focus à la recherche quand aucune modale n\'est ouverte', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT — LE FOCUS N'EST PAS DÉJÀ SUR LA RECHERCHE. Sans lui,
       l'assertion centrale serait vraie même si le raccourci ne faisait
       rien du tout : un test qui ne peut pas échouer ne mesure rien. */
    await expect(page.locator('#searchInput')).not.toBeFocused();

    await page.keyboard.press('Control+f');

    /* --- L'ASSERTION CENTRALE --- */
    await expect(page.locator('#searchInput')).toBeFocused();
});
