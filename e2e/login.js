/* Connexion au compte de test, avec reprises.
 *
 * POURQUOI LE SETUP MÉRITE PLUS DE RÉSILIENCE QU'UN TEST. Un test qui tombe
 * en coûte un ; le setup qui tombe en coûte quatre-vingts. Le 25 août 2026,
 * le run 32858437895 s'est arrêté en une minute sur ce fichier, laissant
 * « 82 did not run ». Il avait pourtant la même protection qu'un test
 * ordinaire — le `retries: 1` global —, et ses deux tentatives se sont
 * suivies à dix-sept secondes d'intervalle.
 *
 * CE QUI S'ÉTAIT PASSÉ, lu dans les journaux Supabase sur la fenêtre exacte
 * des deux tentatives : la seule requête parvenue au projet était le
 * préflight CORS, qui avait répondu 200 en 12 ms.
 *
 *     request.method: OPTIONS
 *     request.path:   /auth/v1/token?grant_type=password
 *     response.status_code: 200
 *
 * Le POST qui suit n'est jamais arrivé — aucune entrée dans auth_logs, et le
 * projet était ACTIVE_HEALTHY. Les identifiants n'ont donc même pas été
 * soumis à l'épreuve : la requête s'est perdue entre le runner et Supabase.
 *
 * D'OÙ DES REPRISES ESPACÉES, et non une simple répétition. Rejouer
 * immédiatement, c'est retomber dans la même coupure ; c'est exactement ce
 * qu'a fait la reprise automatique de Playwright. Les attentes croissantes
 * ci-dessous laissent au réseau le temps de revenir.
 */

/** Attentes, en millisecondes, AVANT chacune des tentatives. La première
 *  part sans délai : le cas normal ne doit rien coûter. */
const ATTENTES = [0, 3_000, 10_000];

/** Délai accordé à la navigation vers index.html après le clic. Plus large
 *  que les 15 s d'origine : une réponse lente n'est pas une réponse perdue,
 *  et la distinction ne se fait qu'en attendant. */
const DELAI_NAVIGATION = 20_000;

/** Marqueur posé par App.init() une fois store.initFromSupabase() terminé.
 *  Partagé avec helpers.js pour qu'il n'existe qu'une définition. */
export const DELAI_APP_PRETE = 30_000;

/**
 * Remplit le formulaire de connexion et attend l'arrivée sur index.html.
 * Réessaie, en espaçant, tant qu'il reste des tentatives.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 * @returns {Promise<number>} le rang (1, 2, …) de la tentative qui a abouti
 * @throws la dernière erreur si toutes les tentatives échouent
 */
export async function connecterAvecReprises(page, email, password) {
    let derniereErreur;

    for (let i = 0; i < ATTENTES.length; i++) {
        if (ATTENTES[i]) await page.waitForTimeout(ATTENTES[i]);
        try {
            /* Recharger à chaque tentative : après un échec réseau, la page
               porte un message d'erreur et un champ peut avoir été vidé. */
            await page.goto('auth.html');
            await page.locator('#loginEmail').fill(email);
            await page.locator('#loginPassword').fill(password);
            await page.locator('#btnLogin').click();
            await page.waitForURL(/index\.html/, { timeout: DELAI_NAVIGATION });
            if (i > 0) console.log(`[login] abouti à la tentative ${i + 1}`);
            return i + 1;
        } catch (erreur) {
            derniereErreur = erreur;
            /* Une seule ligne : le message complet de Playwright tient sur
               une dizaine et noierait le journal des tentatives suivantes. */
            const premiereLigne = String(erreur.message).split('\n')[0];
            console.log(
                `[login] tentative ${i + 1}/${ATTENTES.length} échouée : ${premiereLigne}`);
        }
    }

    throw derniereErreur;
}
