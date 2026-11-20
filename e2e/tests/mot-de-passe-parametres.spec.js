import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Changer son mot de passe depuis les paramètres, une fois connecté.
 *
 * LE BESOIN (demande de l'utilisateur, 20/11/2026) : #180 a rendu le lien
 * « mot de passe oublié » utilisable ; mais un utilisateur connecté qui
 * veut simplement changer de mot de passe n'avait aucun moyen de le faire
 * — l'application n'appelait updateUser({ password }) nulle part avant
 * #180, et seulement depuis l'écran de récupération depuis.
 *
 * LA RÈGLE : onglet « Profil » des paramètres, groupe « Mot de passe » :
 * nouveau mot de passe et confirmation, 8 caractères au moins, identiques ;
 * « Changer mon mot de passe » appelle auth.updatePassword(), et un message
 * (role=status) dit le résultat.
 *
 * LE COMPTE DE TEST EST PARTAGÉ : son mot de passe ne doit JAMAIS changer.
 * La requête PUT /auth/v1/user est interceptée, son contenu relevé, et la
 * réponse est celle d'une simple LECTURE de l'utilisateur.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion centrale
 * « champ « Nouveau mot de passe » absent des paramètres ». Le discriminant
 * — le panneau des paramètres s'ouvre sur l'onglet Profil — passe. */

const NOUVEAU = 'Essai-E2E-pas-envoye-2';

test('un utilisateur connecté change son mot de passe depuis les paramètres', async ({ page, context }) => {
    const envois = [];
    await context.route('**/auth/v1/user**', async (route) => {
        const req = route.request();
        if (req.method() !== 'PUT') return route.continue();
        envois.push(JSON.parse(req.postData() || '{}'));
        const lecture = await route.fetch({ method: 'GET', postData: undefined });
        return route.fulfill({ response: lecture });
    });

    await page.goto('index.html');
    await waitForAppReady(page);
    await page.locator('#settingsBtn').click();
    const panneau = page.locator('.settings-panel.open');

    /* DISCRIMINANT — LE PANNEAU S'OUVRE, sur l'onglet Profil (son champ
       « nom » est là). Ferme « le champ manquerait parce que le panneau ne
       s'est pas ouvert ». Passe avant comme après. */
    await expect(panneau, 'le panneau des paramètres s\'ouvre').toBeVisible({ timeout: 10_000 });
    await expect(panneau.locator('#settingsUserName'), 'onglet Profil affiché').toBeVisible();

    // --- L'ASSERTION CENTRALE ---
    const champ = panneau.locator('#settingsNewPassword');
    await expect(champ, 'champ « Nouveau mot de passe » absent des paramètres').toHaveCount(1);

    const confirmation = panneau.locator('#settingsNewPasswordConfirm');
    const bouton = panneau.locator('#settingsPasswordBtn');
    const statut = panneau.locator('#settingsPasswordStatus');

    /* Différents : refusé, rien n'est envoyé. */
    await champ.fill(NOUVEAU);
    await confirmation.fill(NOUVEAU + 'x');
    await bouton.click();
    await expect(statut, 'les deux saisies doivent être identiques').toContainText('identiques');
    expect(envois, 'rien n\'est envoyé').toHaveLength(0);

    /* Trop court : refusé. */
    await champ.fill('court');
    await confirmation.fill('court');
    await bouton.click();
    await expect(statut, '8 caractères au moins').toContainText('8 caractères');
    expect(envois, 'rien n\'est envoyé').toHaveLength(0);

    /* Valide : envoyé une fois, et le message le dit ; les champs sont vidés. */
    await champ.fill(NOUVEAU);
    await confirmation.fill(NOUVEAU);
    await bouton.click();
    await expect.poll(() => envois.length, { message: 'le nouveau mot de passe est envoyé une fois' }).toBe(1);
    expect(envois[0].password === NOUVEAU, 'la demande porte le mot de passe saisi').toBe(true);
    await expect(statut, 'le message dit que c\'est fait').toContainText('modifié');
    await expect(champ, 'le champ est vidé').toHaveValue('');
});
