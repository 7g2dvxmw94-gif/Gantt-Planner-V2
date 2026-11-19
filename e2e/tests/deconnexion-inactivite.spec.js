import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Audit de sécurité, point S1 : la session se ferme après 30 minutes
 * d'inactivité.
 *
 * LE DÉFAUT, mesuré : la session Supabase est gardée dans le navigateur
 * (persistSession) et renouvelée automatiquement (autoRefreshToken) ; aucun
 * code ne surveille l'inactivité. Un poste laissé ouvert reste connecté
 * indéfiniment.
 *
 * LA RÈGLE (choix de l'utilisateur) : à 29 minutes sans activité, une
 * fenêtre d'avertissement (alertdialog) décompte la dernière minute, avec
 * « Rester connecté » ; à 30 minutes, déconnexion de ce navigateur et
 * retour à l'écran de connexion, qui dit pourquoi. La dernière activité est
 * partagée entre onglets (localStorage « gp.derniereActivite »).
 *
 * LE TEMPS N'EST PAS SIMULÉ PAR UNE FAUSSE HORLOGE : avancer l'horloge de
 * 30 minutes ferait renouveler le jeton par Supabase, sur le compte
 * PARTAGÉ par toute la suite. Le test VIEILLIT la dernière activité
 * enregistrée — ce que verrait un onglet resté seul —, puis déclenche la
 * vérification par l'événement « focus » (retour à l'onglet).
 *
 * LA DÉCONNEXION NE DOIT PAS ATTEINDRE LE SERVEUR : elle révoquerait la
 * session commune à tous les tests de la suite (storageState). La requête
 * /auth/v1/logout est donc interceptée et répondue ici ; le test compte
 * qu'elle est bien partie.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « l'avertissement d'inactivité doit paraître ». Le discriminant
 * — l'application chargée, connectée — passe. */

const MIN = 60 * 1000;
const CLE = 'gp.derniereActivite';

const vieillir = (page, ageMs) => page.evaluate(({ cle, ageMs }) => {
    localStorage.setItem(cle, String(Date.now() - ageMs));
    window.dispatchEvent(new Event('focus'));
}, { cle: CLE, ageMs });

const jetonSession = (page) => page.evaluate(() =>
    Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)));

test('après 29 minutes sans activité un avertissement paraît ; à 30 minutes la session se ferme', async ({ page, context }) => {
    let deconnexionsServeur = 0;
    await context.route('**/auth/v1/logout**', (route) => {
        deconnexionsServeur++;
        return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT — L'APPLICATION EST CHARGÉE ET CONNECTÉE. Ferme « le
       retour à l'écran de connexion viendrait d'une session absente dès le
       départ ». Passe avant comme après. */
    expect(await jetonSession(page), 'une session est présente au départ').toBe(true);

    const avertissement = page.getByRole('alertdialog');
    const rester = avertissement.getByRole('button', { name: 'Rester connecté' });

    // --- L'ASSERTION CENTRALE ---
    /* 29 min 30 s sans activité : l'avertissement paraît, prend le focus,
       et décompte la minute restante. */
    await vieillir(page, 29 * MIN + 30_000);
    await expect(avertissement, 'l\'avertissement d\'inactivité doit paraître').toBeVisible({ timeout: 10_000 });
    await expect(rester, 'le bouton « Rester connecté » a le focus').toBeFocused();
    await expect(avertissement, 'le décompte dit les secondes restantes').toContainText(/\b(2\d|30) s\b/);
    expect(page.url(), 'encore dans l\'application').toMatch(/index\.html/);

    /* « Rester connecté » ferme l'avertissement et repart de zéro. */
    const avantClic = Date.now();
    await rester.click();
    await expect(avertissement, 'l\'avertissement se ferme').toHaveCount(0);
    expect(Number(await page.evaluate((cle) => localStorage.getItem(cle), CLE)),
        'la dernière activité repart de maintenant').toBeGreaterThanOrEqual(avantClic - 1000);

    /* UN AUTRE ONGLET ACTIF garde celui-ci ouvert : l'avertissement se
       ferme sans clic quand l'autre onglet enregistre une activité. */
    await vieillir(page, 29 * MIN + 30_000);
    await expect(avertissement, 'l\'avertissement reparaît').toBeVisible({ timeout: 10_000 });
    const autre = await context.newPage();
    await autre.goto('index.html');
    await waitForAppReady(autre);
    await expect(avertissement, 'l\'activité d\'un autre onglet ferme l\'avertissement').toHaveCount(0, { timeout: 10_000 });
    await autre.close();

    /* 31 minutes : déconnexion, retour à l'écran de connexion qui dit
       pourquoi, session effacée de ce navigateur. */
    await vieillir(page, 31 * MIN);
    /* L'ADRESSE FINALE, pas l'événement de navigation : deux redirections
       vers auth.html partent presque ensemble (celle du module, et celle
       qu'app.js fait sur SIGNED_OUT) ; la première est annulée par la
       seconde, et waitForURL échouait alors sur « net::ERR_ABORTED » bien
       que la page arrive à destination (run 44613792838). */
    await expect.poll(() => page.url(), { message: 'retour à l\'écran de connexion', timeout: 15_000 }).toMatch(/auth\.html/);
    await page.waitForLoadState('load');
    await expect(page.locator('#alertBox'), 'l\'écran de connexion dit pourquoi')
        .toContainText('30 minutes d\'inactivité', { timeout: 10_000 });
    expect(await jetonSession(page), 'la session est effacée de ce navigateur').toBe(false);
    expect(deconnexionsServeur, 'la déconnexion a été demandée une fois (interceptée)').toBe(1);
});
