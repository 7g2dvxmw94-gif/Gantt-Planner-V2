import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Le panneau « Date d'état », ouvert sur un projet, ne se ferme pas quand
 * l'événement de CE projet arrive en retard.
 *
 * LE DÉFAUT, mesuré en intégration (run 44649900013) : date-etat-barre.spec.js
 * reste « flaky » sur `champ.fill` — « element is not visible » — après #175.
 * #175 compare le projet de l'événement à celui du PRÉCÉDENT événement.
 * Or setActiveProject() pose l'identifiant actif tout de suite et n'émet
 * 'project:change' qu'après le chargement depuis Supabase : un panneau
 * ouvert dans cet intervalle — sur le nouveau projet — reçoit un événement
 * dont l'identifiant diffère du dernier mémorisé, et se ferme. C'est le cas
 * juste après la création d'un projet. Le test de #175 attendait 1,5 s avant
 * d'ouvrir le panneau : il ne passait pas par cet intervalle.
 *
 * LA RÈGLE : la référence est le projet affiché À L'OUVERTURE du panneau.
 * Le panneau se ferme si l'événement porte sur un autre projet que celui-là.
 *
 * LE TEST rejoue l'intervalle sans dépendre d'aucun délai : deux projets,
 * A puis B ; setActiveProject(A) lancé sans l'attendre, le panneau ouvert
 * dans la même tâche, puis la promesse attendue.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion centrale
 * « le panneau ouvert sur A reste ouvert quand l'événement de A arrive ».
 * Les discriminants — le projet actif est bien A, le panneau s'est ouvert —
 * passent. */

const projetActif = (page) => page.evaluate(async () => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    return store.getActiveProject()?.name ?? null;
});

test('le panneau « Date d\'état » ouvert pendant le chargement d\'un projet reste ouvert', async ({ page }) => {
    const s = Date.now();
    const nomA = `E2E PanneauA ${s}`;
    const nomB = `E2E PanneauB ${s}`;
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, nomA);
    await createProject(page, nomB);
    /* Laisser passer les événements différés des deux créations. */
    await page.waitForTimeout(1500);
    expect(await projetActif(page), 'B est le projet actif').toBe(nomB);

    const ouvert = await page.evaluate(async (nomA) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const a = store.getProjects().find(p => p.name === nomA);
        const changement = store.setActiveProject(a.id);   // NON attendu : l'id passe à A, l'événement viendra
        document.getElementById('dateEtatBtn').click();     // le panneau s'ouvre, sur A
        const ouvertAvant = document.getElementById('dateEtatPopover').style.display !== 'none';
        await changement;                                    // l'événement de A arrive
        return ouvertAvant;
    }, nomA);

    /* DISCRIMINANTS — le projet actif est A, et le panneau s'était ouvert.
       Ferme « rien ne s'est ouvert » et « l'événement portait sur un autre
       projet ». Passent avant comme après. */
    expect(await projetActif(page), 'A est le projet actif').toBe(nomA);
    expect(ouvert, 'le panneau s\'est ouvert').toBe(true);

    // --- L'ASSERTION CENTRALE ---
    await expect(page.locator('#dateEtatChamp'), 'le panneau ouvert sur A reste ouvert quand l\'événement de A arrive')
        .toBeVisible({ timeout: 2000 });

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);   // A
    await page.evaluate(async (nomB) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        await store.setActiveProject(store.getProjects().find(p => p.name === nomB).id);
    }, nomB);
    await deleteActiveProject(page);   // B
});
