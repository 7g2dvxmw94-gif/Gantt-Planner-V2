import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § A6, étape 1 : le calendrier est un champ du
 * PROJET, gardé en base.
 *
 * LE BESOIN (plan du calendrier par projet, C0). Le calendrier — jours
 * ouvrés, fériés français, Alsace-Moselle, fériés propres — est un réglage
 * du COMPTE (settings.customization.calendar). Sur un projet partagé,
 * chaque membre calcule donc les dates avec le sien. Première marche : le
 * projet doit pouvoir porter son calendrier et le garder en base
 * (migration 031, projects.calendar). Le moteur ne le lit pas encore (C1).
 *
 * LA RÈGLE DE NORMALISATION (calendrierNormalise, utils.js) : jours ouvrés
 * entiers de 0 à 6, sans doublon, triés ; fériés propres en AAAA-MM-JJ
 * lisibles, sans doublon, triés — une date illisible est écartée ;
 * useFrenchHolidays et alsaceMoselle booléens.
 *
 * L'ÉCRITURE PASSE PAR store.setProjectCalendar(id, calendrier). Le test
 * l'appelle si elle existe, et note « absente » sinon : le rouge tombe alors
 * sur l'assertion centrale, pas sur une exception du test.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « calendrier du projet relu après rechargement » : undefined au
 * lieu du calendrier écrit. Les discriminants passent. */

const ECRIT = {
    workingDays: [6, 1, 2, 3, 4, 5, 5],
    holidays: ['2026-06-12', '2026-02-30', '2026-05-29', '2026-06-12'],
    useFrenchHolidays: false,
    alsaceMoselle: true,
};
const ATTENDU = {
    workingDays: [1, 2, 3, 4, 5, 6],
    holidays: ['2026-05-29', '2026-06-12'],
    useFrenchHolidays: false,
    alsaceMoselle: true,
};

async function etat(page) {
    return page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const p = store.getActiveProject();
        return { id: p?.id ?? null, calendrier: p?.calendar, compte: JSON.stringify(store.getCalendar()) };
    });
}

test('un projet garde son calendrier en base, normalisé, sans toucher au calendrier du compte', async ({ page }) => {
    const nomProjet = `E2E CalendrierProjet ${Date.now()}`;
    const erreurs = [];
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });

    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, nomProjet);
    const avant = await etat(page);

    const ecriture = await page.evaluate(async ({ calendrier }) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        if (typeof store.setProjectCalendar !== 'function') return 'absente';
        return await store.setProjectCalendar(store.getActiveProject().id, calendrier);
    }, { calendrier: ECRIT });

    /* DISCRIMINANT 1 — LE CALENDRIER DU COMPTE N'A PAS BOUGÉ. Ferme
       « l'écriture est allée dans les réglages du compte » : un vert
       obtenu ainsi relirait le bon calendrier pour la mauvaise raison, et
       changerait celui de tous les autres projets. Passe avant comme après. */
    expect((await etat(page)).compte, 'le calendrier du compte est inchangé').toBe(avant.compte);

    /* DISCRIMINANT 2 — LA BASE N'A RIEN REFUSÉ (migration 031 absente :
       PostgREST rejette une colonne inconnue). */
    expect(erreurs.filter(e => /setProjectCalendar|calendar/i.test(e)), 'aucune écriture du calendrier refusée').toEqual([]);

    await page.reload();
    await waitForAppReady(page);

    /* DISCRIMINANT 3 — LE PROJET ROUVERT EST CELUI DU TEST. */
    const apres = await etat(page);
    expect(apres.id, 'après rechargement, le projet actif est celui du test').toBe(avant.id);
    await expectProjectName(page, nomProjet);
    expect(apres.compte, 'après rechargement, le calendrier du compte est inchangé').toBe(avant.compte);

    // --- L'ASSERTION CENTRALE ---
    expect({ ecriture, calendrier: apres.calendrier }, 'calendrier du projet relu après rechargement')
        .toEqual({ ecriture: true, calendrier: ATTENDU });

    await deleteActiveProject(page);
});
