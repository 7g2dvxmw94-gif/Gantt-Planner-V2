import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F3c : niveaux affichés et repli par défaut de
 * l'organigramme (F3a, F3b).
 *
 * L'ATTENDU.
 * - Barre de la vue : « Niveaux : 1 | 2 | Tout ». « 1 » replie tout nœud
 *   de niveau 1 ; « 2 » montre les niveaux 1 et 2 ; « Tout » déplie tout.
 * - Un nœud replié porte « +n », n = ses descendants masqués (pas ses
 *   seuls enfants directs).
 * - Repli par défaut, à la première ouverture du projet dans la session :
 *   tout déplié jusqu'à 80 nœuds (le seuil de virtualisation du Gantt),
 *   niveaux 1 et 2 au-delà, et toujours niveaux 1 et 2 sous 768 px.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 3 failed — « sélecteur de niveaux
 * absent » ; 84 boîtes visibles au lieu de 12 ; 9 codes visibles à 375 px
 * au lieu de 8. Les discriminants passent. */

function jeu(s, extra = []) {
    const t = (cle, ordre, plus = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-12',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...plus,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E WbsOrganigramme ${s}`, description: '' },
        tasks: [
            t('L', 0, { startDate: '2026-05-26', endDate: '2026-05-29', progress: 100 }),
            t('A', 1, { isPhase: true }),
            t('A1', 2, { parentId: 'jeu-A', startDate: '2026-06-01', endDate: '2026-06-05', progress: 40 }),
            t('A2', 3, { parentId: 'jeu-A', isMilestone: true, startDate: '2026-06-19', endDate: '2026-06-19', progress: 100 }),
            t('B', 4, { isPhase: true }),
            t('B1', 5, { isPhase: true, parentId: 'jeu-B' }),
            t('B1a', 6, { parentId: 'jeu-B1', startDate: '', endDate: '' }),
            t('B2', 7, { parentId: 'jeu-B', isPermit: true, permitStatus: 'under_review', startDate: '2026-06-22', endDate: '2026-07-31' }),
            t('T', 8, { progress: 10 }),
            ...extra.map(f => f(t)),
        ],
        resources: [],
    };
}

async function monter(page, s, extra) {
    const donnees = jeu(s, extra);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'wbs-organigramme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);
    await expect(page.locator('#tabTimeline'), 'la vue active est le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT COMMUN — L'ARBRE IMPORTÉ EST CELUI QU'ON CROIT, lu au
       Gantt (clé et niveau). Ferme « un ordre faux viendrait du jeu ». */
    const lignes = await page.locator('.gantt-row').evaluateAll((rows, s) => rows.map(r => {
        const nom = r.querySelector('.task-name')?.title || '';
        const m = nom.match(new RegExp(`^(\\S+) ${s}$`));
        return m ? `${m[1]}:${r.getAttribute('aria-level')}` : null;
    }).filter(Boolean), String(s));
    expect(lignes, 'l\'arbre du Gantt').toEqual(['L:1', 'A:1', 'A1:2', 'A2:2', 'B:1', 'B1:2', 'B1a:3', 'B2:2', 'T:1']);
}

async function ouvrirWbs(page) {
    await expect(page.locator('#tabWbs'), 'onglet WBS absent').toHaveCount(1);
    await page.locator('#tabWbs').click();
    await expect(page.locator('#wbsView [role="tree"]'), 'organigramme absent').toHaveCount(1);
}

/** Le treeitem d'une clé (L, A1…). */
function boite(page, cle, s) {
    return page.locator('#wbsView [role="treeitem"]').filter({ has: page.locator(`:scope > .wbs-boite .wbs-nom[title="${cle} ${s}"]`) });
}

async function finir(page) {
    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
}


/** Les codes des boîtes visibles, dans l'ordre. */
async function codesVisibles(page) {
    return page.locator('#wbsView [role="treeitem"]').evaluateAll(lis => lis
        .filter(li => !li.closest('[role="group"][hidden]'))
        .map(li => li.dataset.wbsCode));
}

/** Le badge « +n » d'une boîte, ou null. */
async function badge(page, cle, s) {
    const b = boite(page, cle, s).locator(':scope > .wbs-boite .wbs-masques');
    return (await b.count()) ? b.textContent() : null;
}

test('sélecteur de niveaux : 1, 2, Tout, avec le nombre de tâches masquées', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);
    /* DISCRIMINANT — à l'ouverture, petit projet sur bureau : tout est
       déplié (9 codes). */
    expect(await codesVisibles(page), 'tout déplié à l\'ouverture').toHaveLength(9);

    // --- L'ASSERTION CENTRALE ---
    const choix = page.locator('#wbsView .wbs-niveaux');
    await expect(choix, 'sélecteur de niveaux absent').toHaveCount(1);
    await choix.getByRole('button', { name: '1', exact: true }).click();
    expect(await codesVisibles(page), 'niveau 1').toEqual(['1', '2', '3', '4']);
    expect(await badge(page, 'A', s), 'A repliée : +2').toBe('+2');
    expect(await badge(page, 'B', s), 'B repliée : +3, ses descendants').toBe('+3');

    await choix.getByRole('button', { name: '2', exact: true }).click();
    expect(await codesVisibles(page), 'niveaux 1 et 2').toEqual(['1', '2', '2.1', '2.2', '3', '3.1', '3.2', '4']);
    expect(await badge(page, 'B1', s), 'B1 repliée : +1').toBe('+1');
    expect(await badge(page, 'B', s), 'B dépliée : pas de badge').toBeNull();

    await choix.getByRole('button', { name: 'Tout', exact: true }).click();
    expect(await codesVisibles(page), 'tout').toEqual(['1', '2', '2.1', '2.2', '3', '3.1', '3.1.1', '3.2', '4']);

    await finir(page);
});

test('au-delà de 80 tâches, l\'organigramme s\'ouvre aux niveaux 1 et 2', async ({ page }) => {
    const s = Date.now();
    const donnees = {
        project: { id: 'jeu-projet', name: `E2E WbsNiveauxGros ${s}`, description: '' },
        tasks: [], resources: [],
    };
    const t = (id, ordre, plus = {}) => ({
        id, name: `${id} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-12', progress: 0,
        priority: 'medium', status: 'todo', color: '#6366F1', order: ordre, parentId: null,
        isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [], ...plus,
    });
    let ordre = 0;
    for (let p = 1; p <= 3; p++) {
        donnees.tasks.push(t(`P${p}`, ordre++, { isPhase: true }));
        for (let q = 1; q <= 3; q++) {
            donnees.tasks.push(t(`P${p}S${q}`, ordre++, { isPhase: true, parentId: `P${p}` }));
            for (let r = 1; r <= 8; r++) donnees.tasks.push(t(`P${p}S${q}T${r}`, ordre++, { parentId: `P${p}S${q}` }));
        }
    }
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'wbs-niveaux.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` })).toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* DISCRIMINANT — LE JEU FRANCHIT LE SEUIL : 84 tâches dans le store.
       Le Gantt ne peut pas servir de témoin : il virtualise au-delà de 80
       lignes. */
    const n = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getTasks().length;
    });
    expect(n, 'tâches du projet').toBe(84);

    await ouvrirWbs(page);
    // --- L'ASSERTION CENTRALE ---
    expect(await codesVisibles(page), 'boîtes visibles à l\'ouverture').toHaveLength(12);

    await finir(page);
});

test('sous 768 px, l\'organigramme s\'ouvre aux niveaux 1 et 2', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await page.setViewportSize({ width: 375, height: 800 });
    /* DISCRIMINANT — LA VUE EST EN MODE MOBILE : navigation du bas visible,
       onglets du haut masqués. */
    await expect(page.locator('.mobile-nav'), 'navigation du bas visible').toBeVisible();
    await expect(page.locator('.tabs[role="tablist"]'), 'onglets du haut masqués').toBeHidden();
    const bouton = page.locator('.mobile-nav-item[data-view="wbs"]');
    await expect(bouton, 'bouton WBS de la navigation du bas').toHaveCount(1);
    await bouton.click();
    await expect(page.locator('#wbsView [role="tree"]'), 'organigramme').toHaveCount(1);

    // --- L'ASSERTION CENTRALE ---
    expect(await codesVisibles(page), 'niveaux 1 et 2 sur mobile').toEqual(['1', '2', '2.1', '2.2', '3', '3.1', '3.2', '4']);
    expect(await badge(page, 'B1', s), 'B1 repliée : +1').toBe('+1');

    await page.setViewportSize({ width: 1280, height: 720 });
    await finir(page);
});
