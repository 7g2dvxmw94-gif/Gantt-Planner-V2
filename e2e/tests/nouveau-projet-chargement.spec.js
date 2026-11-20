import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Un projet n'est annoncé « créé » qu'une fois CHARGÉ.
 *
 * LE DÉFAUT, mesuré en intégration : _createNewProject() (app.js) appelle
 * store.setActiveProject() SANS L'ATTENDRE, puis affiche le toast
 * « … créé ». setActiveProject() pose l'identifiant actif tout de suite,
 * charge les données du projet depuis Supabase, et n'émet
 * 'project:change' qu'ensuite. Tout ce qui se fait entre le toast et ce
 * chargement court contre lui :
 *   - une référence (baseline) créée dans l'intervalle disparaît de la
 *     liste : le chargement remplace les références en mémoire par celles
 *     lues AVANT sa création (baseline-active-persistance, « flaky » aux
 *     runs 44577976063, 44686351762, 44719814004 : toast vu, ligne
 *     absente) ;
 *   - le panneau « Date d'état » se refermait (#175, #178).
 * Les autres appels — choisir un projet dans la liste, dupliquer, ouvrir
 * une notification — ont la même forme.
 *
 * LA RÈGLE : l'appel est attendu ; le toast ne paraît qu'après
 * 'project:change'.
 *
 * LE TEST relève, dans la page, l'instant de chaque 'project:change' et
 * celui où le toast « créé » paraît, puis compare leur ordre. Il ne dépend
 * d'aucun délai : avant correctif, l'événement suit toujours le toast (il
 * attend une réponse réseau, le toast non).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « le projet est chargé avant d'être annoncé créé » : ordre
 * toast puis événement. Les discriminants — un événement et un toast
 * relevés, le projet actif est le nouveau — passent. */

test('un nouveau projet n\'est annoncé « créé » qu\'une fois chargé', async ({ page }) => {
    const nomProjet = `E2E ProjetCharge ${Date.now()}`;
    await page.goto('index.html');
    await waitForAppReady(page);

    await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        window.__releve = [];
        const emettre = store._emit.bind(store);
        store._emit = (evt, ...args) => {
            if (evt === 'project:change') window.__releve.push('evenement');
            return emettre(evt, ...args);
        };
        const zone = document.getElementById('toastContainer');
        new MutationObserver(() => {
            if (!window.__releve.includes('toast') && zone.textContent.includes(`"${nom}"`)) window.__releve.push('toast');
        }).observe(zone, { childList: true, subtree: true, characterData: true });
    }, nomProjet);

    await createProject(page, nomProjet);

    /* DISCRIMINANTS — un événement ET le toast ont été relevés, et le
       projet actif est le nouveau. Ferme « l'ordre ne dirait rien : un des
       deux n'a pas eu lieu ». Passent avant comme après. */
    await expect.poll(() => page.evaluate(() => [...new Set(window.__releve)].sort().join(',')),
        { message: 'un événement et un toast relevés', timeout: 15_000 }).toBe('evenement,toast');
    expect(await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), 'le projet actif est le nouveau').toBe(nomProjet);

    // --- L'ASSERTION CENTRALE ---
    const ordre = await page.evaluate(() => window.__releve.filter((x, i, t) => t.indexOf(x) === i));
    expect(ordre, 'le projet est chargé avant d\'être annoncé créé').toEqual(['evenement', 'toast']);

    await deleteActiveProject(page);
});
