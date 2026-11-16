import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F5 : l'export CSV porte le code WBS de chaque tâche,
 * en PREMIÈRE colonne « WBS ». L'en-tête devient « WBS;Niveau
 * hiérarchique;Nom;Durée;Début;Fin;Noms ressources;% achevé » puis les
 * colonnes de contrainte ; l'aide d'import MS Project mappe « WBS » vers
 * le champ WBS.
 *
 * LE JEU : celui de export-arborescence.spec.js, plus le jalon JAL (ordre
 * 9) sous la sous-phase P2. Codes attendus : T1 1, P 2, C 2.1, T2 3, P1 4,
 * P2 4.1, X 4.1.1, JAL 4.1.2, ORD 5, SOUS 5.1.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 2 failed, tous deux sur
 * l'en-tête, qui commence par « Niveau hiérarchique », sans « WBS » : ce
 * test, et export-csv.spec.js, mis à jour dans le même commit. Le
 * discriminant passe. */

const ENTETE = ['WBS', 'Niveau hiérarchique', 'Nom', 'Durée', 'Début', 'Fin', 'Noms ressources', '% achevé'];
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
        project: { id: 'jeu-projet', name: `E2E ExportCsvWbs ${suffixe}`, description: '' },
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

test('l\'export CSV porte le code WBS de chaque tâche, en première colonne', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    const csv = await fs.readFile(await exporter(page, 'CSV'), 'latin1');
    await (await present(page.locator('#msHelpOk'), 'aide d\'import MS Project')).click();
    const [entete, ...lignes] = csv.split('\n');
    const colonnes = entete.split(';');

    /* DISCRIMINANT — la colonne « Nom », lue par son en-tête, suit l'arbre
       du Gantt (#137) : un code faux ne viendrait pas de l'ordre. */
    const iNom = colonnes.indexOf('Nom');
    expect(iNom, 'colonne « Nom »').toBeGreaterThanOrEqual(0);
    expect(cles(lignes.map(l => l.split(';')[iNom]), s), 'l\'ordre des lignes du CSV').toEqual(ORDRE_GANTT);

    // --- L'ASSERTION CENTRALE ---
    expect(colonnes.slice(0, 8), 'l\'en-tête du CSV').toEqual(ENTETE);
    const lus = Object.fromEntries(lignes.map(l => l.split(';'))
        .map(c => [cles([c[iNom]], s)[0], c[0]]).filter(([k]) => k));
    expect(lus, 'la cellule WBS de chaque ligne').toEqual(CODES);

    await deleteActiveProject(page);
});
