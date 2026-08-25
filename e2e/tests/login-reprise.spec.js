import { test, expect } from '../fixtures.js';
import { connecterAvecReprises } from '../login.js';

/* Vérifie la résilience ajoutée au setup d'authentification.
 *
 * CE TEST N'EXPOSE PAS UN DÉFAUT DE L'APPLICATION, et il ne suit donc pas la
 * discipline rouge-puis-vert du reste de la suite : il n'y a rien de cassé
 * dans le produit, seulement une fragilité dans l'outil qui sert à le
 * mesurer. Ce qu'il établit, c'est que la reprise ajoutée dans login.js
 * fonctionne pour de bon plutôt que sur parole.
 *
 * CE QU'IL SIMULE. Le 25 août 2026, le POST de connexion s'est perdu entre
 * le runner et Supabase : seul le préflight CORS était parvenu au projet,
 * qui répondait pourtant en 12 ms et se portait bien. La suite entière — 82
 * tests — n'a pas tourné. On reproduit exactement cela en coupant la
 * PREMIÈRE requête de connexion, et on exige que le login aboutisse quand
 * même.
 *
 * UNE COUPURE ET UNE SEULE. Les journaux de l'incident montrent un préflige
 * OPTIONS par tentative, et un seul : le client Supabase ne réessaie pas de
 * lui-même. La seconde requête vue par l'intercepteur ne peut donc venir
 * que de la reprise de login.js, et de rien d'autre.
 *
 * SESSION VIERGE. Le projet `chromium` injecte le storageState du setup,
 * c'est-à-dire une session déjà ouverte : auth.html renverrait aussitôt sur
 * index.html et le test ne mesurerait rien. On repart donc d'un stockage
 * vide.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test('la connexion survit à une requête perdue', async ({ page }) => {
    const email    = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (!email || !password) {
        throw new Error('E2E_TEST_EMAIL / E2E_TEST_PASSWORD manquants. Voir .env.example.');
    }

    let posts = 0;
    await page.route('**/auth/v1/token*', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        posts++;
        /* On ne coupe que la première : la suivante doit passer, sans quoi
           le test mesurerait l'échec plutôt que la reprise. */
        if (posts === 1) return route.abort('failed');
        return route.continue();
    });

    const rang = await connecterAvecReprises(page, email, password);

    /* DISCRIMINANT — L'INTERCEPTION A BIEN PORTÉ. Sans lui, un test qui
       n'aurait rien coupé du tout passerait tout aussi bien : la connexion
       aurait simplement réussi du premier coup, et l'on croirait avoir
       vérifié une reprise qui n'a jamais eu lieu. Deux requêtes : celle
       qu'on a coupée, et celle de la reprise. */
    expect(posts).toBe(2);

    /* --- L'ASSERTION CENTRALE ---
       C'est bien la SECONDE tentative de login.js qui a abouti. Exiger le
       rang, et pas seulement le succès, distingue « la reprise a sauvé la
       connexion » de « la connexion n'avait pas besoin d'être sauvée ». */
    expect(rang).toBe(2);

    await expect(page).toHaveURL(/index\.html/);
});
