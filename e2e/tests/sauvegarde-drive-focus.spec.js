import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § F (sauvegarde distante) et § AC1 (clavier) :
 * la fenêtre de sauvegarde Google Drive prend le focus et le retient.
 *
 * PREMIÈRE COUVERTURE DE cloud-backup.js. Ce module — 290 lignes qui
 * manipulent les données de l'utilisateur — n'était mentionné par aucun
 * test. Ce fichier n'atteint pas ses appels à l'API Drive, qui
 * demanderaient de simuler Google ; il atteint sa PORTE D'ENTRÉE, et y
 * trouve un défaut qui n'a rien à voir avec Google.
 *
 * L'INVARIANT EST ÉCRIT DANS app.js, à trente lignes du défaut. Le
 * commentaire du garde-fou de Ctrl+F dit :
 *
 *     « y envoyer le focus dément le `aria-modal="true"` que la fenêtre
 *       pose — SA PROMESSE QUE RIEN AU DEHORS N'EST ATTEIGNABLE — et le
 *       piège à focus que task-modal.js fait respecter à Tab. »
 *
 * LE RECENSEMENT EST ACCABLANT. Neuf éléments déclarent
 * `aria-modal="true"` : la fenêtre de tâche, l'import MS Project, les
 * raccourcis, le contact, Google Drive, OneDrive, le partage,
 * l'onboarding, et un neuvième. DEUX pièges de Tab existent dans tout le
 * dépôt — task-modal.js et settings-panel.js (#77). SEPT déclarations
 * font donc une promesse que rien ne tient.
 *
 * ET CELLE-CI NE PREND MÊME PAS LE FOCUS. `_showCloudBackupModal()`
 * n'appelle aucun .focus(). Pire : le chemin d'ouverture passe par
 * `settings-panel.close()`, qui rend le focus à `#settingsBtn` — dans
 * l'en-tête, DERRIÈRE le voile. La fenêtre s'ouvre donc avec le focus
 * déjà dehors.
 *
 * AUCUNE DONNÉE GOOGLE N'EST REQUISE. Sans client ID enregistré, la
 * fenêtre s'ouvre sur son formulaire de configuration, qui porte un
 * bouton de fermeture, un lien, un champ et un bouton de validation :
 * de quoi éprouver le focus sans jamais toucher à l'API Drive.
 *
 * DEUX TESTS INDÉPENDANTS. Le second place lui-même le focus sur le
 * dernier contrôle : il ne dépend donc pas du premier, et les deux
 * moitiés du défaut — prendre le focus, le retenir — sont mesurées
 * séparément.
 */

/** Ouvre la fenêtre Google Drive par le chemin réel : réglages, onglet
 *  Synchro, puis le bouton. Aucun raccourci par événement synthétique —
 *  c'est ce chemin-là qui laisse le focus derrière le voile. */
async function ouvrirFenetreDrive(page) {
    await page.goto('index.html');
    await waitForAppReady(page);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('.settings-panel.open')).toBeVisible({ timeout: 10_000 });
    await page.locator('.settings-tab[data-tab="synchro"]').click();
    await page.locator('#settingsGDriveBtn').click();
    await expect(page.locator('#cloudBackupModal')).toBeVisible({ timeout: 10_000 });
}

/** Le focus est-il dans la fenêtre ? Lu par document.activeElement, qui
 *  fait foi, et sans exiger d'élément d'arrivée précis : l'ordre des
 *  contrôles n'est pas en cause et peut légitimement changer. */
function focusDansLaFenetre(page) {
    return page.evaluate(() =>
        !!document.activeElement && !!document.activeElement.closest('#cloudBackupModal'));
}

test('la fenêtre de sauvegarde Google Drive prend le focus à l\'ouverture', async ({ page }) => {
    await ouvrirFenetreDrive(page);

    /* DISCRIMINANT — LA FENÊTRE SE DÉCLARE MODALE ET A DE QUOI RECEVOIR
       LE FOCUS. Sans `aria-modal="true"`, elle ne promettrait rien et il
       n'y aurait rien à reprocher ; sans contrôle focalisable, exiger le
       focus n'aurait pas de sens. Cette attente passe avant comme après
       le correctif. */
    const etat = await page.evaluate(() => {
        const f = document.getElementById('cloudBackupModal');
        return {
            promesse: f.getAttribute('aria-modal'),
            focalisables: f.querySelectorAll(
                'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])').length,
        };
    });
    expect(etat.promesse).toBe('true');
    expect(etat.focalisables).toBeGreaterThan(1);

    /* --- L'ASSERTION CENTRALE ---
       Une fenêtre qui se déclare modale et laisse le focus dehors est
       inutilisable au clavier : la première tabulation parcourt la page
       masquée au lieu de la fenêtre. */
    await expect.poll(() => focusDansLaFenetre(page), { timeout: 5_000 }).toBe(true);
});

test('une tabulation ne fait pas sortir de la fenêtre Google Drive', async ({ page }) => {
    await ouvrirFenetreDrive(page);

    /* On se place sur le DERNIER contrôle focalisable, trouvé plutôt que
       nommé — le formulaire de configuration peut changer sans que le
       défaut change. Ce test ne dépend donc pas du focus initial, et
       reste valable si le premier échoue. */
    const surLeDernier = await page.evaluate(() => {
        const f = document.getElementById('cloudBackupModal');
        const focalisables = f.querySelectorAll(
            'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focalisables.length) return false;
        focalisables[focalisables.length - 1].focus();
        return document.activeElement === focalisables[focalisables.length - 1];
    });

    /* DISCRIMINANT — LE DERNIER CONTRÔLE EXISTE ET A PRIS LE FOCUS.
       Sans lui, une tabulation depuis nulle part prouverait n'importe
       quoi. Passe avant comme après le correctif. */
    expect(surLeDernier).toBe(true);

    /* --- L'ASSERTION CENTRALE ---
       `aria-modal="true"` promet que rien au dehors n'est atteignable.
       Tab doit donc revenir au début plutôt que de gagner la page. */
    await page.keyboard.press('Tab');
    expect(await focusDansLaFenetre(page)).toBe(true);
});
