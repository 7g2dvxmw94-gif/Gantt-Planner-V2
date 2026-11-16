import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { tableurCsv, importerTableur } from '../tableur.js';

/* WBS, fonctionnalité F7 : l'import Excel reconnaît une colonne de codes
 * WBS et en tire la hiérarchie.
 *
 * L'ATTENDU.
 * - Une colonne dont un MOT de l'en-tête est wbs, otp ou sdp, et dont
 *   toutes les valeurs, lues en TEXTE, sont des codes, donne la hiérarchie
 *   (parent de 1.2.3 = 1.2) et l'ordre (tri naturel : 1.2 avant 1.10). Une
 *   ligne qui a des enfants devient une phase ; ses dates sont celles de
 *   ses descendants, calculées des plus profondes aux plus hautes.
 * - « 1.0 » se lit « 1 ».
 * - Codes en double : import à plat, avertissement qui cite les codes.
 * - Colonnes « Phase » et « WBS » ensemble : la hiérarchie vient des
 *   codes, avertissement « colonne Phase ignorée ».
 * - Une colonne « WBS » qui porte des NOMS reste lue comme aujourd'hui,
 *   en noms de phases (garde).
 *
 * LE PIÈGE. SheetJS lit « 1.10 » d'un CSV comme le NOMBRE 1.1 dans les
 * lignes typées ; seule la lecture en texte (raw:false) garde « 1.10 »
 * (mesuré, xlsx-0.20.3). Le jeu met donc dix enfants sous « 1 ».
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 5 failed (tests 1, 2, 4, 5, 6),
 * chacun sur son assertion centrale ; le test 3 (garde) passe avant comme
 * après. Les discriminants passent. */

const ENFANTS = ['Fondations', 'Soubassement', 'Dallage', 'Murs', 'Poteaux', 'Poutres', 'Plancher', 'Escalier', 'Charpente', 'Toiture'];

/** Les lignes du Gantt : « nom:niveau », « P » pour une phase. */
async function lignesGantt(page) {
    return page.locator('.gantt-row').evaluateAll(rows => rows.map(r =>
        `${r.querySelector('.task-name')?.title}:${r.getAttribute('aria-level')}${r.classList.contains('phase') ? 'P' : ''}`));
}

async function importer(page, nomProjet, entetes, lignes) {
    await page.goto('index.html');
    await waitForAppReady(page);
    await importerTableur(page, nomProjet, tableurCsv(entetes, lignes));
    /* DISCRIMINANT — L'IMPORT A EU LIEU : le toast porte le nom du projet. */
    await expect(page.locator('#toastContainer .toast', { hasText: nomProjet }).first(),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);
}

/** « début→fin » d'une tâche, relue du store. */
async function dates(page, nom) {
    return page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const x = store.getTasks().find(t => t.name === nom);
        return x ? `${x.startDate}→${x.endDate}` : 'absente';
    }, nom);
}

function jeuComplet() {
    return [
        ['1', 'Gros oeuvre', '', ''],
        ...ENFANTS.map((n, i) => [`1.${i + 1}`, n, `2026-06-0${(i % 5) + 1}`, `2026-06-0${(i % 5) + 3}`]),
        ['2', 'Second oeuvre', '', ''],
        ['2.1', 'Cloisons', '', ''],
        ['2.1.1', 'Placo', '2026-06-15', '2026-06-19'],
    ];
}

test('import Excel : la colonne WBS donne la hiérarchie, 1.10 compris', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbs ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Debut', 'Fin'], jeuComplet());
    /* DISCRIMINANT — LES DATES SONT LUES : Fondations porte les siennes. */
    expect(await dates(page, 'Fondations'), 'dates de Fondations').toBe('2026-06-01→2026-06-03');

    // --- L'ASSERTION CENTRALE ---
    expect(await lignesGantt(page), 'les lignes du Gantt').toEqual([
        'Gros oeuvre:1P', ...ENFANTS.map(n => `${n}:2`), 'Second oeuvre:1P', 'Cloisons:2P', 'Placo:3',
    ]);
    await deleteActiveProject(page);
});

test('import Excel : une phase de niveau 1 prend les dates de ses descendants', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbsDates ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Debut', 'Fin'], jeuComplet());
    expect(await dates(page, 'Placo'), 'dates de Placo').toBe('2026-06-15→2026-06-19');
    // --- L'ASSERTION CENTRALE ---
    expect(await dates(page, 'Second oeuvre'), 'Second oeuvre, des dates de Placo').toBe('2026-06-15→2026-06-19');
    await deleteActiveProject(page);
});

test('import Excel : une colonne « WBS » qui porte des noms reste lue en phases (garde)', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbsNoms ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Debut', 'Fin'], [
        ['Gros oeuvre', 'Fondations', '2026-06-01', '2026-06-03'],
        ['Gros oeuvre', 'Murs', '2026-06-04', '2026-06-05'],
        ['Second oeuvre', 'Placo', '2026-06-15', '2026-06-19'],
    ]);
    expect(await lignesGantt(page), 'les lignes du Gantt, comme avant').toEqual([
        'Gros oeuvre:1P', 'Fondations:2', 'Murs:2', 'Second oeuvre:1P', 'Placo:2',
    ]);
    await deleteActiveProject(page);
});

test('import Excel : des codes en double donnent un import à plat et un avertissement', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbsDoublons ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Debut', 'Fin'], [
        ['1', 'A', '', ''], ['1.1', 'A1', '2026-06-01', '2026-06-03'], ['1.1', 'A2', '2026-06-04', '2026-06-05'],
    ]);
    // --- L'ASSERTION CENTRALE ---
    expect(await lignesGantt(page), 'à plat').toEqual(['A:1', 'A1:1', 'A2:1']);
    await expect(page.locator('#toastContainer .toast', { hasText: 'en double' }), 'avertissement des doublons')
        .toContainText('1.1');
    await deleteActiveProject(page);
});

test('import Excel : « 1.0 » se lit « 1 »', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbsZero ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Debut', 'Fin'], [
        ['1.0', 'A', '', ''], ['1.1', 'A1', '2026-06-01', '2026-06-03'],
        ['2.0', 'B', '', ''], ['2.1', 'B1', '2026-06-04', '2026-06-05'],
    ]);
    // --- L'ASSERTION CENTRALE ---
    expect(await lignesGantt(page), 'A ⊃ A1, B ⊃ B1').toEqual(['A:1P', 'A1:2', 'B:1P', 'B1:2']);
    await deleteActiveProject(page);
});

test('import Excel : avec « Phase » et « WBS », la hiérarchie vient des codes', async ({ page }) => {
    const nomProjet = `E2E ImportExcelWbsPhase ${Date.now()}`;
    await importer(page, nomProjet, ['WBS', 'Nom', 'Phase', 'Debut', 'Fin'], [
        ['1', 'A', 'Lot A', '', ''], ['1.1', 'A1', 'Lot A', '2026-06-01', '2026-06-03'],
    ]);
    // --- L'ASSERTION CENTRALE ---
    expect(await lignesGantt(page), 'hiérarchie des codes').toEqual(['A:1P', 'A1:2']);
    await expect(page.locator('#toastContainer .toast', { hasText: 'Colonne Phase ignorée' }), 'avertissement').toHaveCount(1);
    await deleteActiveProject(page);
});
