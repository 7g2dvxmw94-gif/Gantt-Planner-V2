import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E (réglages) : le panneau de réglages retient le
 * focus, comme le fait la fenêtre de tâche depuis #64.
 *
 * LE DÉFAUT : le panneau se comporte en modale sur tous les points sauf
 * un. Il se déclare `role="dialog"`, occupe le plan des modales
 * (`--z-modal`), verrouille le défilement du corps
 * (`document.body.style.overflow = 'hidden'`), prend le focus à
 * l'ouverture, le rend au bouton de réglages à la fermeture, et se ferme
 * sur Échap. Mais aucun gestionnaire de `Tab` ne le referme sur
 * lui-même : un `grep` sur settings-panel.js ne trouve qu'un `keydown`,
 * celui d'Échap.
 *
 * LA COMPARAISON EST INTERNE AU DÉPÔT. task-modal.js:562 fait exactement
 * ce qui manque ici :
 *
 *     if (e.key === 'Tab') {
 *         const focusable = modal.querySelectorAll('button, [href], …');
 *         …
 *     }
 *
 * Deux composants jouent le même rôle, un seul tient sa promesse — la
 * forme de défaut qui a produit #56, #57 et #66, ici sur l'interface
 * plutôt que sur le calcul.
 *
 * POURQUOI LE DÉFAUT EST DÉTERMINISTE. `_buildPanel()` ajoute le voile
 * puis le panneau à la FIN du corps, et `#settingsPanelClose` est le
 * PREMIER élément focalisable du panneau. Une tabulation arrière depuis
 * ce bouton sort donc du panneau par construction, vers le dernier
 * élément focalisable de la page — c'est-à-dire derrière le voile.
 *
 * CE QUE VIT L'UTILISATEUR. Au clavier ou au lecteur d'écran, le focus
 * quitte le panneau sans que rien ne le signale, et se pose sur des
 * commandes masquées par le voile : on agit à l'aveugle sur l'application
 * qu'on croyait suspendue.
 *
 * CE TEST NE PORTE PAS SUR LA LATENCE DE `visibility`. Le panneau a la
 * même forme que `.modal-overlay` avant #63 — `visibility: hidden` plus
 * une transition sur `visibility` —, et son focus initial ne tient que
 * parce que `open()` le diffère de 100 ms. C'est réel, mais masqué de
 * façon fiable, et aucun rouge ne l'atteint : signalé par un commentaire
 * dans le code plutôt que corrigé à l'aveugle.
 */

/* AUCUN PROJET N'EST CRÉÉ : le panneau de réglages s'ouvre sans, et rien
   n'est donc à nettoyer. Mais il faut attendre que l'application soit
   prête — _bindToggle() n'est posé qu'à l'initialisation, et un clic
   antérieur ne ferait rien, en silence. */
async function ouvrirReglages(page) {
    await page.goto('index.html');
    await waitForAppReady(page);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('.settings-panel.open')).toBeVisible({ timeout: 10_000 });
}

/** Le focus est-il à l'intérieur du panneau ? Lu dans la page plutôt que
 *  par un localisateur : c'est `document.activeElement` qui fait foi, et
 *  aucun élément d'arrivée précis n'est exigé — l'ordre des contrôles du
 *  panneau n'est pas en cause et peut légitimement changer. */
function focusDansLePanneau(page) {
    return page.evaluate(() =>
        !!document.activeElement && !!document.activeElement.closest('.settings-panel'));
}

test('une tabulation arrière ne fait pas sortir du panneau de réglages', async ({ page }) => {
    await ouvrirReglages(page);

    /* DISCRIMINANT — LE FOCUS INITIAL A PRIS.
       open() diffère le focus de 100 ms ; l'attendre par expect.poll
       plutôt que par une attente fixe. Sans ce point de départ, une
       tabulation partirait de <body> et le test mesurerait le
       comportement par défaut du document, non celui du panneau. Cette
       attente passe avant comme après le correctif. */
    await expect.poll(
        () => page.evaluate(() => document.activeElement && document.activeElement.id),
        { timeout: 10_000 },
    ).toBe('settingsPanelClose');

    /* --- L'ASSERTION CENTRALE ---
       Le bouton de fermeture est le premier élément focalisable du
       panneau, et le panneau est le dernier élément du corps : une
       tabulation arrière sort donc du panneau tant qu'aucun piège ne la
       renvoie à la fin. */
    await page.keyboard.press('Shift+Tab');
    expect(await focusDansLePanneau(page)).toBe(true);
});

test('une tabulation avant depuis le dernier contrôle ne sort pas du panneau', async ({ page }) => {
    await ouvrirReglages(page);

    /* On se place sur le DERNIER contrôle focalisable du panneau, trouvé
       plutôt que nommé : citer #settingsSaveBtn ferait échouer le test
       pour une raison étrangère au défaut le jour où le pied de panneau
       changera. */
    const surLeDernier = await page.evaluate(() => {
        const panneau = document.querySelector('.settings-panel');
        const focalisables = panneau.querySelectorAll(
            'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focalisables.length) return false;
        focalisables[focalisables.length - 1].focus();
        return document.activeElement === focalisables[focalisables.length - 1];
    });

    /* DISCRIMINANT — LE DERNIER CONTRÔLE EXISTE ET A PRIS LE FOCUS.
       Sans lui, une tabulation depuis nulle part prouverait n'importe
       quoi. Cette attente passe avant comme après le correctif. */
    expect(surLeDernier).toBe(true);

    /* --- L'ASSERTION CENTRALE, AUTRE SENS ---
       Un piège n'en est un que s'il ferme les deux bouts. Vérifier la
       seule tabulation arrière laisserait passer une correction qui ne
       traite qu'une direction. */
    await page.keyboard.press('Tab');
    expect(await focusDansLePanneau(page)).toBe(true);
});
