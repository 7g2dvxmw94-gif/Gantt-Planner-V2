import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F3d : l'organigramme signale les tâches qu'il ne
 * peut pas placer.
 *
 * LE PROBLÈME. Une tâche prise dans une boucle de parents (la fiche la
 * refuse depuis #107, mais d'anciennes données ou un import peuvent la
 * porter), ou dont la chaîne des parents mène à une tâche disparue, est
 * hors de l'arbre : sans code WBS, absente du Gantt et de l'organigramme.
 * Rien ne la montre.
 *
 * L'ATTENDU. Dans la vue WBS, « N tâche(s) hors arborescence », qui
 * déplie la liste des noms avec la raison : boucle, ou sous-boucle (un
 * ancêtre est dans une boucle).
 *
 * LE JEU, importé en JSON : T, racine ; L1 et L2, parents l'un de
 * l'autre ; E, enfant de L1. (Un parent qui n'existe pas n'est pas un
 * cas : l'import le détache déjà — mesuré par une première version de ce
 * test, dont le discriminant a relu la tâche à la racine.)
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur « mention hors
 * arborescence absente ». Les discriminants passent. */

test('la vue WBS nomme les tâches hors arborescence, avec la raison', async ({ page }) => {
    const s = Date.now();
    const t = (cle, ordre, plus = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-12',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order: ordre, parentId: null,
        isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [], ...plus,
    });
    const donnees = {
        project: { id: 'jeu-projet', name: `E2E WbsHorsArborescence ${s}`, description: '' },
        tasks: [t('T', 0), t('L1', 1, { parentId: 'jeu-L2' }), t('L2', 2, { parentId: 'jeu-L1' }),
                t('E', 3, { parentId: 'jeu-L1' })],
        resources: [],
    };
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'wbs-hors.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` })).toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* DISCRIMINANT — LES PARENTS SONT ARRIVÉS TELS QUELS : L1 → L2, L2 →
       L1, E → L1. Ferme « l'import a cassé la boucle, il n'y a rien à
       signaler ». */
    const parents = await page.evaluate(async (s) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const nom = (id) => taches.find(x => x.id === id)?.name.split(' ')[0] ?? (id ? 'absent' : 'racine');
        return Object.fromEntries(['T', 'L1', 'L2', 'E'].map(c => {
            const x = taches.find(y => y.name === `${c} ${s}`);
            return [c, x ? nom(x.parentId) : 'tâche absente'];
        }));
    }, String(s));
    expect(parents, 'les parents relus').toEqual({ T: 'racine', L1: 'L2', L2: 'L1', E: 'L1' });

    await page.locator('#tabWbs').click();
    await expect(page.locator('#wbsView [role="tree"]'), 'organigramme').toHaveCount(1);

    // --- L'ASSERTION CENTRALE ---
    const mention = page.locator('#wbsView .wbs-hors');
    await expect(mention, 'mention hors arborescence absente').toHaveCount(1);
    await expect(mention.locator('summary'), 'le nombre').toHaveText('3 tâche(s) hors arborescence');
    await mention.locator('summary').click();
    const lignes = await mention.locator('li').allTextContents();
    expect(lignes.sort(), 'les tâches et leurs raisons').toEqual([
        `E ${s} — sous-boucle`, `L1 ${s} — boucle`, `L2 ${s} — boucle`,
    ]);

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
