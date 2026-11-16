import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F3b : dans l'organigramme (F3a), replier une
 * branche, naviguer au clavier, et retrouver le focus en fermant la fiche.
 *
 * L'ATTENDU.
 * - Replier : ← sur un nœud déplié le replie (aria-expanded="false", ses
 *   descendants masqués), → le déplie. L'état est celui de la SESSION :
 *   jamais task.collapsed, persisté et partagé avec l'équipe.
 * - Clavier (motif d'arbre de l'APG ARIA) : ↓ ↑ parmi les boîtes
 *   visibles ; → sur un nœud déplié va au premier enfant ; ← sur une
 *   feuille ou un nœud replié va au parent ; Début, Fin ; * déplie tous
 *   les frères. Toujours un seul tabindex=0.
 * - Focus rendu : fermer la fiche ouverte depuis une boîte rend le focus à
 *   cette boîte, y compris après un enregistrement qui redessine la vue.
 *
 * LE JEU : celui de F3a (wbs-organigramme.spec.js).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 3 failed, chacun sur sa première
 * assertion centrale : B reste aria-expanded="true" après ← ; A1 n'a pas
 * le focus après ↓ ; le focus est sur BODY après « Annuler ». Les
 * discriminants passent. */

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


/** Clé (L, A1…) de l'élément focalisé, ou son nom de balise. */
async function focalise(page, s) {
    return page.evaluate((s) => {
        const el = document.activeElement;
        const nom = el?.querySelector?.(':scope > .wbs-boite .wbs-nom')?.textContent;
        return nom ? nom.replace(` ${s}`, '') : el?.tagName;
    }, String(s));
}

async function unSeulArret(page, etape) {
    expect(await page.locator('#wbsView [role="treeitem"][tabindex="0"]').count(), `un seul tabindex=0 (${etape})`).toBe(1);
}

test('repli : ← replie une branche, pour la session seulement', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);
    const b = boite(page, 'B', s);
    await expect(b, 'boîte B').toHaveCount(1);
    await b.locator(':scope > .wbs-boite .wbs-nom').click();
    await expect(b, 'B focalisée').toBeFocused();
    /* DISCRIMINANT — B EST DÉPLIÉE avant le geste : sinon ← ne prouverait
       rien. */
    await expect(b, 'B dépliée avant le geste').toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowLeft');
    // --- L'ASSERTION CENTRALE ---
    await expect(b, 'B repliée par ←').toHaveAttribute('aria-expanded', 'false');
    for (const cle of ['B1', 'B1a', 'B2']) await expect(boite(page, cle, s), `${cle} masquée`).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(b, 'B dépliée par →').toHaveAttribute('aria-expanded', 'true');
    await expect(boite(page, 'B2', s), 'B2 de nouveau visible').toBeVisible();

    /* Le repli ne touche pas task.collapsed : replié dans l'organigramme,
       B1 reste visible au Gantt. */
    await page.keyboard.press('ArrowLeft');
    await expect(b, 'B repliée de nouveau').toHaveAttribute('aria-expanded', 'false');
    await page.locator('#tabTimeline').click();
    await expect(page.locator(`.gantt-row .task-name[title="B1 ${s}"]`), 'B1 visible au Gantt').toBeVisible();
    await deleteActiveProject(page);
});

test('clavier : flèches, Début, Fin et * parcourent l\'arbre', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);
    const a = boite(page, 'A', s);
    await expect(a, 'boîte A').toHaveCount(1);
    await a.locator(':scope > .wbs-boite .wbs-nom').click();
    /* DISCRIMINANT — A focalisée, dépliée. */
    await expect(a, 'A focalisée').toBeFocused();
    await expect(a, 'A dépliée').toHaveAttribute('aria-expanded', 'true');

    // --- L'ASSERTION CENTRALE ---
    const etape = async (touche, attendu, quoi) => {
        await page.keyboard.press(touche);
        await expect.poll(() => focalise(page, s), { message: `${quoi} : focus sur ${attendu}` }).toBe(attendu);
        await unSeulArret(page, quoi);
    };
    await etape('ArrowDown', 'A1', '↓ depuis A');
    await etape('ArrowUp', 'A', '↑ depuis A1');
    await page.keyboard.press('ArrowLeft');
    await expect(a, '← replie A').toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => focalise(page, s), { message: 'A garde le focus après le repli' }).toBe('A');
    await page.keyboard.press('ArrowRight');
    await expect(a, '→ déplie A').toHaveAttribute('aria-expanded', 'true');
    await etape('ArrowRight', 'A1', '→ sur A dépliée');
    await etape('ArrowLeft', 'A', '← sur la feuille A1');
    await etape('Home', 'L', 'Début');
    await etape('End', 'T', 'Fin');

    /* B puis A repliées ; * depuis L déplie ses frères repliés. */
    await boite(page, 'B', s).locator(':scope > .wbs-boite .wbs-nom').click();
    await page.keyboard.press('ArrowLeft');
    await a.locator(':scope > .wbs-boite .wbs-nom').click();
    await page.keyboard.press('ArrowLeft');
    await expect(boite(page, 'B', s), 'B repliée').toHaveAttribute('aria-expanded', 'false');
    await expect(a, 'A repliée').toHaveAttribute('aria-expanded', 'false');
    await etape('Home', 'L', 'Début avant *');
    await page.keyboard.press('*');
    await expect(a, '* déplie A').toHaveAttribute('aria-expanded', 'true');
    await expect(boite(page, 'B', s), '* déplie B').toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => focalise(page, s), { message: 'L garde le focus après *' }).toBe('L');
    await unSeulArret(page, 'après *');

    await finir(page);
});

test('focus rendu : fermer la fiche rend le focus à la boîte', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);
    const a1 = boite(page, 'A1', s);
    await expect(a1, 'boîte A1').toHaveCount(1);
    await a1.locator(':scope > .wbs-boite .wbs-nom').click();
    /* DISCRIMINANT — A1 a le focus avant d'ouvrir la fiche. */
    await expect(a1, 'A1 focalisée').toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#taskName'), 'fiche de A1').toHaveValue(`A1 ${s}`);
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
    // --- L'ASSERTION CENTRALE ---
    await expect.poll(() => focalise(page, s), { message: 'focus rendu à A1 après « Annuler »' }).toBe('A1');
    await expect(a1, 'A1 est l\'arrêt de tabulation').toHaveAttribute('tabindex', '0');

    /* Après un enregistrement, qui redessine la vue. */
    await page.keyboard.press('Enter');
    await expect(page.locator('#taskName'), 'fiche de A1, encore').toHaveValue(`A1 ${s}`);
    await page.locator('#taskProgress').fill('50');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
    await expect(a1.locator(':scope > .wbs-boite .wbs-etat-texte'), 'A1 affiche 50%').toHaveText('50%');
    await expect.poll(() => focalise(page, s), { message: 'focus rendu à A1 après « Enregistrer »' }).toBe('A1');

    await finir(page);
});
