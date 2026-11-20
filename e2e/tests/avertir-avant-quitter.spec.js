import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Quitter la page pendant une écriture en base demande confirmation.
 *
 * LE DÉFAUT : une modification part en base en arrière-plan (E1, #173 :
 * store.ecrituresEnCours()). Si l'utilisateur recharge ou ferme l'onglet
 * avant la fin, la modification est perdue, sans rien voir.
 *
 * LA RÈGLE (E2) : tant qu'une ÉCRITURE en base est en cours, quitter la
 * page déclenche l'avertissement standard du navigateur (« Quitter la
 * page ? »). Les lectures en cours (notifications…) n'avertissent pas, et
 * sans écriture en cours on quitte sans question.
 *
 * L'écriture est retenue par une interception de la requête, le temps du
 * rechargement : elle est en cours de façon certaine, pas par hasard.
 * L'avertissement est accepté par la fixture commune (fixtures.js) ; ce
 * test se contente de le noter.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « avertissement avant de quitter avec une écriture en cours ».
 * Les discriminants passent. */

function jeu(s) {
    return {
        project: { id: 'jeu-projet', name: `E2E AvertirQuitter ${s}`, description: '' },
        tasks: [{
            id: 'jeu-a', name: `A Quitter ${s}`, description: '', startDate: '2026-06-01', endDate: '2026-06-05',
            progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order: 0, parentId: null,
            isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [],
        }],
        resources: [],
    };
}

const ecrituresEnCours = (page) => page.evaluate(async () => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    return store.ecrituresEnCours();
});

test('quitter la page pendant une écriture en base demande confirmation', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const nomA = donnees.tasks[0].name;

    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'quitter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    const dialogues = [];
    page.on('dialog', d => { dialogues.push(d.type()); });

    /* DISCRIMINANT — SANS ÉCRITURE EN COURS, ON QUITTE SANS QUESTION.
       Passe avant comme après. */
    await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        await store.attendreEcritures();
    });
    await page.reload();
    await waitForAppReady(page);
    expect(dialogues, 'pas d\'avertissement sans écriture en cours').toEqual([]);
    // Une action de l'utilisateur sur la page : sans elle, le navigateur
    // n'affiche jamais l'avertissement.
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    /* Une écriture en base, retenue le temps du rechargement. */
    let relacher;
    const retenue = new Promise(r => { relacher = r; });
    await page.route('**/rest/v1/tasks**', async (route) => {
        if (route.request().method() === 'GET') return route.continue();
        await retenue;
        await route.continue().catch(() => {});
    });
    await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const a = store.getTasks().find(x => x.name === nom);
        store.updateTask(a.id, { endDate: '2026-06-12' });
    }, nomA);

    /* DISCRIMINANT — L'ÉCRITURE EST EN COURS. Passe avant comme après. */
    await expect.poll(() => ecrituresEnCours(page), { message: 'une écriture en cours' }).toBeGreaterThan(0);

    await page.reload();
    relacher();
    await page.unroute('**/rest/v1/tasks**');
    await waitForAppReady(page);

    // --- L'ASSERTION CENTRALE ---
    expect(dialogues, 'avertissement avant de quitter avec une écriture en cours').toContain('beforeunload');

    await deleteActiveProject(page);
});
