import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F8 : l'export PDF peut inclure l'organigramme WBS.
 *
 * L'ATTENDU. Le dialogue d'export PDF propose « Organigramme WBS »,
 * DÉCOCHÉ par défaut (les exports existants ne changent pas) ; le dialogue
 * PowerPoint ne le propose pas. Cochée, la section .wbs-pdf porte les
 * boîtes dans l'ordre des codes, arbre déplié. Tout nom y passe par
 * escapeHtml, attribut `title` compris.
 *
 * LE JEU : celui de F3a.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 2 failed, chacun sur « option
 * WBS absente du dialogue ». Les discriminants passent. */

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


async function ouvrirDialogue(page, format) {
    await page.locator('#exportBtn').click();
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: new RegExp(`^${format}$`) }) })
        .click();
    const dialogue = page.locator('#pdfExportDialog');
    await expect(dialogue).toBeVisible({ timeout: 10_000 });
    return dialogue;
}

async function exporterAvecWbs(page) {
    const dialogue = await ouvrirDialogue(page, 'PDF');
    /* DISCRIMINANT — c'est le dialogue d'export PDF, avec ses sections. */
    await expect(dialogue.locator('input[value="table"]'), 'section « tableau » cochée').toBeChecked();
    // --- L'ASSERTION CENTRALE, 1/2 ---
    const option = dialogue.locator('input[value="wbs"]');
    await expect(option, 'option WBS absente du dialogue').toHaveCount(1);
    await expect(option, 'décochée par défaut').not.toBeChecked();
    await option.check();
    const fenetrePromise = page.waitForEvent('popup');
    await dialogue.locator('.pdf-export-confirm').click();
    return fenetrePromise;
}

test('export PDF : l\'organigramme WBS, option décochée, boîtes dans l\'ordre des codes', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    const fenetre = await exporterAvecWbs(page);
    await expect(fenetre.locator('body'), 'nom du projet').toContainText(`E2E WbsOrganigramme ${s}`, { timeout: 15_000 });

    // --- L'ASSERTION CENTRALE, 2/2 ---
    await expect(fenetre.locator('.wbs-pdf'), 'section .wbs-pdf').toHaveCount(1);
    const codes = await fenetre.locator('.wbs-pdf [data-wbs-code]').evaluateAll(els => els.map(e => e.dataset.wbsCode));
    await fenetre.close();
    expect(codes, 'les boîtes dans l\'ordre des codes').toEqual(['1', '2', '2.1', '2.2', '3', '3.1', '3.1.1', '3.2', '4']);

    /* Le dialogue PowerPoint ne la propose pas. */
    const ppt = await ouvrirDialogue(page, 'PPT');
    await expect(ppt.locator('input[value="wbs"]'), 'pas d\'option WBS en PowerPoint').toHaveCount(0);
    await ppt.locator('.pdf-export-cancel').click();

    await deleteActiveProject(page);
});

test('export PDF : un nom à chevrons arrive intact dans l\'organigramme', async ({ page }) => {
    const s = Date.now();
    /* Sans charge active : chevrons, esperluette, guillemets. */
    const nom = `Étanchéité <MOA> & "lot" ${s}`;
    const temoin = `Visite chantier ${s}`;
    await monter(page, s, [(t) => ({ ...t('X', 9), name: nom }), (t) => ({ ...t('V', 10), name: temoin })]);

    /* DISCRIMINANT 1 — le nom est intact dans l'onglet WBS : ferme
       « mutilé à la saisie ou au stockage ». */
    await page.locator('#tabWbs').click();
    const dansVue = page.locator('#wbsView .wbs-nom').filter({ hasText: '<MOA>' });
    await expect(dansVue, 'nom intact dans la vue WBS').toHaveText(nom);
    await expect(dansVue, 'title intact dans la vue WBS').toHaveAttribute('title', nom);
    await page.locator('#tabTimeline').click();

    const fenetre = await exporterAvecWbs(page);
    /* DISCRIMINANT 2 — la section est produite : le témoin y est. */
    await expect(fenetre.locator('.wbs-pdf'), 'témoin dans la section').toContainText(temoin, { timeout: 15_000 });

    // --- L'ASSERTION CENTRALE ---
    const x = fenetre.locator('.wbs-pdf .wbs-pdf-nom').filter({ hasText: '<MOA>' });
    await expect(x, 'boîte du nom à chevrons').toHaveCount(1);
    await expect(x, 'textContent intact').toHaveText(nom);
    await expect(x, 'title intact').toHaveAttribute('title', nom);
    await fenetre.close();

    await deleteActiveProject(page);
});
