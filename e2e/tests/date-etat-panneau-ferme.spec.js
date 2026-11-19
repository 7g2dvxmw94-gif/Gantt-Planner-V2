import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Le panneau « Date d'état » ne se referme pas tout seul quand le projet
 * actif n'a pas changé.
 *
 * LE DÉFAUT, mesuré en intégration (run 44603256000) : date-etat-barre.spec.js
 * échoue aux deux essais sur `champ.fill` — « element is not visible » —
 * juste après avoir vu le champ visible. Le panneau se ferme sur TOUT
 * 'project:change' (_bindDateEtat, app.js). Or la création d'un projet
 * appelle store.setActiveProject() sans l'attendre : le toast « créé »
 * paraît, puis l'événement arrive APRÈS le chargement depuis Supabase, sur
 * le même projet, et referme le panneau qu'on vient d'ouvrir. Un
 * utilisateur le voit se refermer sous ses doigts.
 *
 * LA RÈGLE : le panneau se ferme quand le projet actif CHANGE, pas quand le
 * même projet est rechargé.
 *
 * LE TEST rejoue l'événement en différé, sans dépendre de la vitesse de la
 * base : il ouvre le panneau, puis appelle setActiveProject() sur le projet
 * déjà actif.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « le panneau reste ouvert quand le même projet est rechargé ».
 * Le discriminant — le panneau s'ouvre — passe. */

test('le panneau « Date d\'état » reste ouvert quand le même projet est rechargé', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, `E2E DateEtatPanneau ${Date.now()}`);

    /* Laisser passer l'événement différé de la création : le test rejoue
       lui-même le rechargement, au moment qu'il choisit. */
    await page.waitForTimeout(1500);

    /* DISCRIMINANT — LE PANNEAU S'OUVRE. Ferme « il ne s'ouvrirait pas du
       tout ». Passe avant comme après. */
    await page.locator('#dateEtatBtn').click();
    const champ = page.locator('#dateEtatChamp');
    await expect(champ, 'le panneau s\'ouvre').toBeVisible();

    await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        await store.setActiveProject(store.getActiveProject().id);
    });

    // --- L'ASSERTION CENTRALE ---
    await expect(champ, 'le panneau reste ouvert quand le même projet est rechargé').toBeVisible({ timeout: 2000 });

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);
});
