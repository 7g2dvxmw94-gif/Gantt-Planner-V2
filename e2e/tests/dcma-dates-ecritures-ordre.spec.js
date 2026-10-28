import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle des champs
 * « date d'état » et « échéance » du rapport DCMA (#84).
 *
 * LE DÉFAUT : deux écritures en vol, sans ordre. Chaque champ du rapport
 * déclenche, à sa modification, une écriture des DEUX colonnes —
 * store.setProjectDates() envoie status_date ET deadline. Remplir la date
 * d'état puis l'échéance envoie donc deux requêtes :
 *
 *     1. { status_date: 2026-06-08, deadline: null }   ← échéance encore vide
 *     2. { status_date: 2026-06-08, deadline: 2026-06-26 }
 *
 * Rien ne garantit qu'elles arrivent dans cet ordre. Si la première arrive
 * en dernier, elle efface l'échéance en base. L'écran, lui, affiche les
 * bonnes valeurs : l'erreur ne se voit qu'au rechargement.
 *
 * TROUVÉ PAR LA CI : dcma-date-etat-echeance.spec.js est sorti flaky au
 * run 40594450369 — échéance relue vide après rechargement au premier
 * essai, date d'état intacte. Exactement ce scénario.
 *
 * POUR QUE LE ROUGE SOIT CERTAIN ET NON PROBABLE, le test RETIENT la
 * première requête 1,5 s (page.route) avant de la laisser partir. Sans
 * correctif, la seconde passe devant, et la première écrase l'échéance à
 * chaque fois. Le correctif doit faire attendre la seconde.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale, avec « échéance relue après rechargement ». */

test('saisir vite la date d\'état puis l\'échéance n\'efface pas l\'échéance', async ({ page }) => {
    const suffixe = Date.now();
    await page.goto('index.html');
    await createProject(page, `E2E DCMAOrdre ${suffixe}`);

    /* Les écritures des deux champs : des PATCH sur la table projects qui
       portent status_date. La première est retenue 1,5 s. */
    const ecritures = [];
    const terminees = [];
    await page.route(url => url.pathname.endsWith('/rest/v1/projects'), async (route) => {
        const requete = route.request();
        const corps = requete.method() === 'PATCH' ? requete.postDataJSON() : null;
        if (!corps || !('status_date' in corps)) return route.continue();
        const rang = ecritures.push(corps);
        if (rang === 1) await new Promise(r => setTimeout(r, 1500));
        await route.continue();
        const reponse = await requete.response();
        terminees.push({ rang, statut: reponse ? reponse.status() : null });
    });

    await page.locator('#dcmaBtn').click();
    const modale = page.locator('#dcmaReportModal');
    await modale.locator('#dcmaDateEtat').fill('2026-06-08');
    await modale.locator('#dcmaEcheance').fill('2026-06-26');
    await expect(modale.locator('.dcma-echeance')).toHaveText('26 juin 2026');

    /* Attendre que les DEUX écritures soient revenues avant de recharger :
       sinon le rechargement couperait la requête retenue, et l'échéance
       serait relue juste sans rien prouver. */
    await expect.poll(() => terminees.length, { timeout: 15_000 }).toBe(2);

    /* DISCRIMINANT 1 — LA COURSE A BIEN ÉTÉ MONTÉE. Deux écritures, la
       première partie avec une échéance vide : c'est elle qui, arrivée en
       dernier, efface. Sans ce point, un vert pourrait venir de ce que la
       course n'a pas eu lieu. Passe avant comme après. */
    expect(ecritures.map(c => [c.status_date, c.deadline]), 'écritures envoyées, dans l\'ordre')
        .toEqual([['2026-06-08', null], ['2026-06-08', '2026-06-26']]);
    expect(terminees.every(t => t.statut >= 200 && t.statut < 300), 'les deux écritures ont abouti').toBe(true);

    await page.keyboard.press('Escape');
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#dcmaBtn').click();

    /* DISCRIMINANT 2 — LA DATE D'ÉTAT, ÉCRITE PAR LES DEUX REQUÊTES, EST
       RELUE. L'écriture arrive donc bien en base : seule l'échéance est en
       jeu. Passe avant comme après. */
    await expect(modale.locator('#dcmaDateEtat'), 'date d\'état relue après rechargement').toHaveValue('2026-06-08');

    // --- L'ASSERTION CENTRALE ---
    await expect(modale.locator('#dcmaEcheance'), 'échéance relue après rechargement').toHaveValue('2026-06-26');

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);
});
