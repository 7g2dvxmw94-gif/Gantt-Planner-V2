import { test, expect } from '../fixtures.js';

/* « Mot de passe oublié » : le lien reçu par e-mail doit permettre de
 * CHOISIR un nouveau mot de passe.
 *
 * LE DÉFAUT, signalé par l'utilisateur le 20/11/2026 et mesuré dans le code :
 * le lien de Supabase (auth.resetPassword, redirectTo auth.html?reset=1)
 * ouvre une session de récupération ; auth.html voit une session et renvoie
 * aussitôt vers l'outil (« if (session) … href = destination »). Aucun
 * formulaire « nouveau mot de passe » n'existe, et aucun appel
 * supabase.auth.updateUser({ password }) nulle part : l'utilisateur est
 * connecté sur l'appareil qui a ouvert l'e-mail, mais son mot de passe ne
 * change jamais — il reste bloqué sur ses autres appareils.
 *
 * LA RÈGLE : arrivé par le lien (auth.html?reset=1, session ouverte),
 * l'utilisateur voit « Choisissez un nouveau mot de passe » : deux champs,
 * 8 caractères au moins, identiques ; l'enregistrement appelle
 * updateUser({ password }), puis l'outil s'ouvre.
 *
 * LE COMPTE DE TEST EST PARTAGÉ : son mot de passe ne doit JAMAIS changer.
 * La requête PUT /auth/v1/user est interceptée, son contenu relevé, et la
 * réponse est celle d'une simple LECTURE de l'utilisateur (GET), sans
 * aucune modification côté serveur.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion centrale
 * « le lien de récupération ouvre le formulaire de nouveau mot de passe » :
 * la page est renvoyée vers index.html. Le discriminant — une session est
 * présente, comme après le clic sur le lien — passe. */

const NOUVEAU = 'Essai-E2E-pas-envoye-1';

test('le lien « mot de passe oublié » permet de choisir un nouveau mot de passe', async ({ page, context }) => {
    const envois = [];
    await context.route('**/auth/v1/user**', async (route) => {
        const req = route.request();
        if (req.method() !== 'PUT') return route.continue();
        envois.push(JSON.parse(req.postData() || '{}'));
        // Aucune modification : on rend la lecture de l'utilisateur courant.
        const lecture = await route.fetch({ method: 'GET', postData: undefined });
        return route.fulfill({ response: lecture });
    });

    await page.goto('auth.html?reset=1');

    /* DISCRIMINANT — UNE SESSION EST PRÉSENTE, comme après le clic sur le
       lien (storageState). Ferme « la page resterait sur auth.html faute de
       session ». Passe avant comme après. */
    expect(await page.evaluate(() => Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k))),
        'une session est présente').toBe(true);

    // --- L'ASSERTION CENTRALE ---
    const formulaire = page.locator('#viewNewPassword');
    await expect(formulaire, 'le lien de récupération ouvre le formulaire de nouveau mot de passe').toBeVisible({ timeout: 10_000 });
    expect(page.url(), 'on reste sur l\'écran de connexion').toMatch(/auth\.html/);

    /* Deux mots de passe différents : refusé, rien n'est envoyé. */
    await page.locator('#newPassword').fill(NOUVEAU);
    await page.locator('#newPasswordConfirm').fill(NOUVEAU + 'x');
    await page.locator('#btnNewPassword').click();
    await expect(page.locator('#alertBox'), 'les deux saisies doivent être identiques').toContainText('identiques');
    expect(envois, 'rien n\'est envoyé').toHaveLength(0);

    /* Trop court : refusé. */
    await page.locator('#newPassword').fill('court');
    await page.locator('#newPasswordConfirm').fill('court');
    await page.locator('#btnNewPassword').click();
    await expect(page.locator('#alertBox'), '8 caractères au moins').toContainText('8 caractères');
    expect(envois, 'rien n\'est envoyé').toHaveLength(0);

    /* Identiques et assez longs : enregistré, puis l'outil s'ouvre. */
    await page.locator('#newPassword').fill(NOUVEAU);
    await page.locator('#newPasswordConfirm').fill(NOUVEAU);
    await page.locator('#btnNewPassword').click();
    await expect.poll(() => envois.length, { message: 'le nouveau mot de passe est envoyé une fois' }).toBe(1);
    expect(envois[0].password === NOUVEAU, 'la demande porte le mot de passe saisi').toBe(true);
    await expect.poll(() => page.url(), { message: 'l\'outil s\'ouvre ensuite', timeout: 15_000 }).toMatch(/index\.html/);
});
