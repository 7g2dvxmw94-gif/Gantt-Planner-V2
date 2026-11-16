import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F3e : zoom de l'organigramme.
 *
 * L'ATTENDU. Trois boutons : −, la valeur courante (« 100% » ; un clic
 * y revient) et +. De 30 à 150 % par pas de 10, bornes tenues. Le zoom
 * s'applique à l'arbre (propriété CSS `zoom`). La valeur est une
 * préférence du navigateur (localStorage `gantt_wbs_zoom`), relue au
 * rechargement. Le contexte de test part d'un localStorage vide : aucune
 * valeur héritée d'un autre test.
 *
 * LE JEU : celui de F3a.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur « zoom absent ».
 * Le discriminant (organigramme présent) passe. */

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


test('zoom : −, 100 %, + de 30 à 150 % par pas de 10, gardé au rechargement', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);

    // --- L'ASSERTION CENTRALE ---
    const zoom = page.locator('#wbsView .wbs-zoom');
    await expect(zoom, 'zoom absent').toHaveCount(1);
    const moins = zoom.locator('.wbs-zoom-moins'), valeur = zoom.locator('.wbs-zoom-valeur'), plus = zoom.locator('.wbs-zoom-plus');
    const zoomCalcule = () => page.locator('#wbsView [role="tree"]').evaluate(el => getComputedStyle(el).zoom);
    /* Pas de zoom hérité : 100 % et zoom 1 avant toute action. */
    await expect(valeur, 'valeur de départ').toHaveText('100%');
    expect(await zoomCalcule(), 'zoom calculé de départ').toBe('1');

    await plus.click();
    await expect(valeur, '+ → 110%').toHaveText('110%');
    expect(await zoomCalcule(), 'zoom calculé à 110 %').toBe('1.1');
    for (let i = 0; i < 4; i++) await zoom.locator('.wbs-zoom-plus').click();
    await expect(valeur, '4 × + → 150%').toHaveText('150%');
    await zoom.locator('.wbs-zoom-plus').click();
    await expect(valeur, 'borne haute : reste 150%').toHaveText('150%');
    await zoom.locator('.wbs-zoom-valeur').click();
    await expect(valeur, 'clic sur la valeur → 100%').toHaveText('100%');
    for (let i = 0; i < 7; i++) await zoom.locator('.wbs-zoom-moins').click();
    await expect(valeur, '7 × − → 30%').toHaveText('30%');
    await zoom.locator('.wbs-zoom-moins').click();
    await expect(valeur, 'borne basse : reste 30%').toHaveText('30%');
    for (let i = 0; i < 9; i++) await zoom.locator('.wbs-zoom-plus').click();
    await expect(valeur, '9 × + → 120%').toHaveText('120%');

    await page.reload();
    await waitForAppReady(page);
    await page.locator('#tabWbs').click();
    await expect(page.locator('#wbsView .wbs-zoom-valeur'), 'gardé au rechargement').toHaveText('120%');
    expect(await zoomCalcule(), 'zoom calculé après rechargement').toBe('1.2');

    await finir(page);
});
