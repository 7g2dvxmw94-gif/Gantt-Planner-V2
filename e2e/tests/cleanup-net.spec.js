/* Tests du filet de nettoyage lui-même (e2e/cleanup.js).
 *
 * Le filet est de l'infrastructure portante : c'est lui qui empêche les
 * tests échoués de laisser des projets sur le compte de test partagé. Il
 * n'avait aucune couverture — sa seule vérification vivait hors du dépôt,
 * donc nulle part.
 *
 * DEUX PARTICULARITÉS ASSUMÉES.
 *
 * 1. Ce fichier importe `test` de @playwright/test, et non de
 *    ../fixtures.js comme toutes les autres specs. Envelopper dans le
 *    filet le test DU filet serait circulaire : la fixture déclencherait
 *    un nettoyage réel pendant qu'on en vérifie un simulé.
 *
 * 2. Il tourne contre un arbre de modules factices (e2e/fixtures/
 *    cleanup-stub) plutôt que contre l'application, et sans session. C'est
 *    ce qui permet d'exercer les branches d'ÉCHEC — suppression qui
 *    n'atteint pas la base, onglet fermé — qu'aucun compte réel ne
 *    permettrait de provoquer à la demande.
 */

import { test, expect } from '@playwright/test';
import { trackProject, trackActiveProject, snapshotCustomization, runCleanup } from '../cleanup.js';

/* L'arbre factice est servi par le serveur statique des tests, au même
   titre que l'application. baseURL est redirigé vers lui pour que le repli
   interne de cleanup.js — un page.goto('index.html') — retombe sur le stub
   et non sur la vraie application.
   Le port et le chemin de base doivent rester alignés sur
   playwright.config.js. */
const RACINE_STUB = 'http://localhost:4173/Gantt-Planner-V2/e2e/fixtures/cleanup-stub/';

test.use({
    baseURL: RACINE_STUB,
    storageState: { cookies: [], origins: [] },   // aucune session requise
});

/** Prépare une page sur l'arbre factice, avec une table de projets donnée. */
async function preparer(page, { projets = [], indestructible = false, reglages = {} } = {}) {
    await page.goto('index.html');
    await page.evaluate(([p, u, s]) => {
        localStorage.setItem('projects', JSON.stringify(p));
        localStorage.setItem('settings', JSON.stringify(s));
        if (u) localStorage.setItem('undeletable', '1');
    }, [projets, indestructible, reglages]);
    await page.reload();
}

/** Ids encore présents dans la table factice. */
function restants(page) {
    return page.evaluate(() =>
        JSON.parse(localStorage.getItem('projects') || '[]').map(r => r.id)
    );
}

test('le projet actif est enregistré, puis supprimé en fin de test', async ({ page }) => {
    await preparer(page, { projets: [{ id: 'seed' }, { id: 'p1', active: true }] });

    expect(await trackActiveProject(page)).toBe('p1');

    await runCleanup(page);
    expect(await restants(page)).toEqual(['seed']);
});

test('un test qui a fait son ménage ne déclenche aucune suppression', async ({ page }) => {
    await preparer(page, { projets: [{ id: 'seed' }] });

    // Enregistré, mais déjà supprimé par le corps du test.
    trackProject(page, 'p1');

    await expect(runCleanup(page)).resolves.toBeUndefined();
    expect(await restants(page)).toEqual(['seed']);
});

test('les projets laissés par un test échoué sont rattrapés', async ({ page }) => {
    await preparer(page, { projets: [{ id: 'seed' }, { id: 'p1' }, { id: 'p2' }] });

    trackProject(page, 'p1');
    trackProject(page, 'p2');

    await expect(runCleanup(page)).resolves.toBeUndefined();
    expect(await restants(page)).toEqual(['seed']);
});

test('une suppression qui n’atteint pas la base fait échouer le nettoyage', async ({ page }) => {
    /* Le cas qui justifie la relecture : la RPC répond sans erreur et ne
       supprime rien, exactement comme supabaseStore.deleteProject() le
       ferait sur un échec serveur — il journalise sans propager. Sans
       vérification, le filet croirait la suppression faite et la fuite
       serait aussi silencieuse qu'avant lui. */
    await preparer(page, { projets: [{ id: 'p1' }], indestructible: true });

    trackProject(page, 'p1');

    await expect(runCleanup(page)).rejects.toThrow(/survivent/);
    expect(await restants(page)).toEqual(['p1']);
});

test('le nettoyage survit à la fermeture de la page du test', async ({ page, context }) => {
    await preparer(page, { projets: [{ id: 'p1' }] });
    trackProject(page, 'p1');

    /* Un second onglet garde le localStorage du contexte accessible après
       la fermeture du premier — et sert de témoin. */
    const temoin = await context.newPage();
    await temoin.goto('index.html');
    await page.close();

    await expect(runCleanup(page)).resolves.toBeUndefined();
    expect(await restants(temoin)).toEqual([]);
});

test('la personnalisation capturée est restaurée', async ({ page }) => {
    await preparer(page, { reglages: { customization: { brandName: 'Origine' } } });

    await snapshotCustomization(page);
    await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        await store.updateSettings({ customization: { brandName: 'E2E Brand' } });
    });

    await runCleanup(page);

    const apres = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getSettings().customization.brandName;
    });
    expect(apres).toBe('Origine');
});
