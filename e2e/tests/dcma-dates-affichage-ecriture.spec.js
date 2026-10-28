import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle des champs
 * « date d'état » et « échéance » du rapport DCMA (#84, #87).
 *
 * LE DÉFAUT : le rapport affiche une valeur comme enregistrée avant
 * qu'elle le soit. Depuis #87, les écritures des deux champs passent en
 * file. Chaque saisie attend SA propre écriture, puis redessine le
 * rapport — à partir de la mémoire, qui contient déjà la saisie suivante.
 * Quand la première écriture revient, le rapport affiche donc l'échéance,
 * alors que la seconde écriture, celle qui la porte, attend encore son
 * tour. Recharger à ce moment la coupe : l'échéance affichée est perdue.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA. Il
 * expose aussi dcma-date-etat-echeance.spec.js (#84), qui recharge dès que
 * l'échéance s'affiche, en comptant sur « affiché ⇒ écrit ».
 *
 * POUR QUE LE ROUGE SOIT CERTAIN, page.route retient les deux écritures :
 * la première 0,5 s — la seconde saisie tombe donc forcément pendant
 * qu'elle est en vol, et le rapport redessiné à son retour contient déjà
 * l'échéance —, la seconde 1,5 s — elle est donc encore en attente quand
 * l'échéance s'affiche. Le test recharge dès cet affichage, comme un
 * utilisateur pressé, et comme le fait le test de #84.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale, avec « échéance relue après rechargement ». */

test('le rapport n\'affiche l\'échéance comme enregistrée qu\'une fois écrite', async ({ page }) => {
    const suffixe = Date.now();
    await page.goto('index.html');
    await createProject(page, `E2E DCMAAffichage ${suffixe}`);

    /* Les écritures des deux champs : des PATCH sur la table projects qui
       portent status_date. La première est retenue 0,5 s, la seconde 1,5 s. */
    const ecritures = [];
    await page.route(url => url.pathname.endsWith('/rest/v1/projects'), async (route) => {
        const requete = route.request();
        const corps = requete.method() === 'PATCH' ? requete.postDataJSON() : null;
        if (!corps || !('status_date' in corps)) return route.continue();
        const rang = ecritures.push(corps);
        await new Promise(r => setTimeout(r, rang === 1 ? 500 : 1500));
        await route.continue().catch(() => {});   // la page peut s'être rechargée entre-temps
    });

    await page.locator('#dcmaBtn').click();
    const modale = page.locator('#dcmaReportModal');
    await modale.locator('#dcmaDateEtat').fill('2026-06-08');
    await modale.locator('#dcmaEcheance').fill('2026-06-26');

    /* Le rapport affiche l'échéance : pour l'utilisateur, elle est
       enregistrée. On recharge aussitôt. */
    await expect(modale.locator('.dcma-echeance')).toHaveText('26 juin 2026');

    /* DISCRIMINANT — LA COURSE A BIEN ÉTÉ MONTÉE : deux écritures ont été
       lancées, la seconde porte l'échéance. Sans ce point, un vert pourrait
       venir de ce que la seconde écriture n'a jamais existé. Passe avant
       comme après. */
    await expect.poll(() => ecritures.length, { timeout: 10_000 }).toBe(2);
    expect(ecritures[1], 'la seconde écriture porte l\'échéance')
        .toMatchObject({ status_date: '2026-06-08', deadline: '2026-06-26' });

    await page.keyboard.press('Escape');
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#dcmaBtn').click();

    // --- L'ASSERTION CENTRALE ---
    await expect(modale.locator('#dcmaEcheance'), 'échéance relue après rechargement').toHaveValue('2026-06-26');

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);
});
