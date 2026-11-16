import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F6 : le tableau de l'export PDF porte le code WBS
 * de chaque ligne, dans une première colonne « WBS » — phases comprises.
 *
 * LE JEU : celui de export-xml-wbs.spec.js (F4). Codes attendus : T1 1,
 * P 2, C 2.1, T2 3, P1 4, P2 4.1, X 4.1.1, JAL 4.1.2, ORD 5, SOUS 5.1.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : aucun en-tête « WBS » (7 en-têtes). Les discriminants
 * passent. */

const ORDRE_GANTT = ['T1', 'P', 'C', 'T2', 'P1', 'P2', 'X', 'JAL', 'ORD', 'SOUS'];
const CODES = { T1: '1', P: '2', C: '2.1', T2: '3', P1: '4', P2: '4.1', X: '4.1.1', JAL: '4.1.2', ORD: '5', SOUS: '5.1' };

function jeu(suffixe) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ExportPdfWbs ${suffixe}`, description: '' },
        tasks: [
            t('T1', 0), t('C', 1, { parentId: 'jeu-P' }), t('T2', 2), t('P', 3, { isPhase: true }),
            t('P1', 4, { isPhase: true }), t('P2', 5, { isPhase: true, parentId: 'jeu-P1' }), t('X', 6, { parentId: 'jeu-P2' }),
            t('ORD', 7), t('SOUS', 8, { parentId: 'jeu-ORD' }),
            t('JAL', 9, { parentId: 'jeu-P2', isMilestone: true, startDate: '2026-06-10', endDate: '2026-06-10' }),
        ],
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** Les clés (T1, C…) des noms d'une liste de textes, dans l'ordre. */
const cles = (textes, suffixe) => textes
    .map(x => (String(x).match(new RegExp(`(\\S+) ${suffixe}`)) || [])[1])
    .filter(Boolean);

async function monter(page, suffixe) {
    const donnees = jeu(suffixe);
    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({ name: 'export-arborescence.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'), 'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT — LE GANTT DESSINE L'ARBRE VOULU, lu sur le `title` des
       noms (jamais le texte, préfixé d'un symbole pour un jalon). Ferme
       « le jeu n'a pas l'arbre voulu ». */
    await expect.poll(async () => cles(await page.locator('.gantt-row .task-name').evaluateAll(els => els.map(e => e.title)), suffixe),
        { message: 'l\'ordre du Gantt' }).toEqual(ORDRE_GANTT);
}

async function exporter(page, format) {
    await (await present(page.locator('#exportBtn'), 'bouton « Exporter »')).click();
    const item = page.locator('.export-dropdown-item').filter({ has: page.locator('.export-dropdown-label', { hasText: new RegExp(`^${format}$`) }) });
    const telechargement = page.waitForEvent('download');
    await item.click();
    return (await telechargement).path();
}

test('le tableau de l\'export PDF porte le code WBS de chaque ligne', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await (await present(page.locator('#exportBtn'), 'bouton « Exporter »')).click();
    await page.locator('.export-dropdown-item').filter({ has: page.locator('.export-dropdown-label', { hasText: /^PDF$/ }) }).click();
    const dialogue = page.locator('#pdfExportDialog');
    await expect(dialogue).toBeVisible({ timeout: 10_000 });
    await expect(dialogue.locator('input[value="table"]'), 'section « tableau » cochée').toBeChecked();
    const fenetrePromise = page.waitForEvent('popup');
    await dialogue.locator('.pdf-export-confirm').click();
    const fenetre = await fenetrePromise;

    /* DISCRIMINANTS — le document est produit : il contient le nom du
       projet et celui de X. */
    await expect(fenetre.locator('body'), 'nom du projet').toContainText(`E2E ExportPdfWbs ${s}`, { timeout: 15_000 });
    await expect(fenetre.locator('body'), 'nom de X').toContainText(`X ${s}`);

    // --- L'ASSERTION CENTRALE ---
    const tableau = fenetre.locator('table').first();
    const entetes = await tableau.locator('thead th').allTextContents();
    expect(entetes[0], 'premier en-tête du tableau').toBe('WBS');
    const iTache = entetes.indexOf('Tâche');
    const lignes = await tableau.locator('tbody tr').evaluateAll((trs, i) => trs.map(tr => {
        const tds = tr.querySelectorAll('td');
        return [tds[i]?.textContent || '', tds[0]?.textContent || ''];
    }), iTache);
    const lus = Object.fromEntries(lignes.map(([nom, code]) => [cles([nom.replace(/\s*\(\d+%\)$/, '')], s)[0], code.trim()]).filter(([k]) => k));
    await fenetre.close();
    expect(lus, 'le code WBS de chaque ligne').toEqual(CODES);

    await deleteActiveProject(page);
});
