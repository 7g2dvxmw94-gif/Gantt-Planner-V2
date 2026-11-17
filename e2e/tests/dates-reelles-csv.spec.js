import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G (export CSV), sous l'angle des DATES RÉELLES :
 * l'export CSV écrit le Début réel et la Fin réelle de chaque tâche.
 *
 * L'ATTENDU. Deux colonnes, « Début réel » et « Fin réelle », après les
 * colonnes de contrainte (les huit premières gardent leur ordre : l'aide
 * d'import MS Project les désigne), au format des autres dates
 * (JJ/MM/AAAA), vides quand la date manque, par la règle unique
 * datesReellesDe.
 *
 * LE JEU, importé :
 *   A  08 → 10/06/2026, réel 08 → 10 ;
 *   B  11 → 15/06, commencée le 11 ;
 *   C  01 → 03/06, sans réel ;
 *   E  16 → 17/06, Fin réelle 17 seule → Début réel 16.
 *
 * Les colonnes sont lues PAR EN-TÊTE, jamais par position.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « colonne « Début réel » absente du CSV ». Les discriminants
 * passent. */

function jeu(s) {
    const t = (cle, ordre, debut, fin, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} Csv ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesCsv ${s}`, description: '' },
        tasks: [
            t('A', 0, '2026-06-08', '2026-06-10', { actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }),
            t('B', 1, '2026-06-11', '2026-06-15', { actualStart: '2026-06-11', progress: 40, status: 'in_progress' }),
            t('C', 2, '2026-06-01', '2026-06-03'),
            t('E', 3, '2026-06-16', '2026-06-17', { actualFinish: '2026-06-17', progress: 100, status: 'done' }),
        ],
        resources: [],
    };
}

test('l\'export CSV écrit le Début réel et la Fin réelle', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'dates-reelles-csv.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    await page.locator('#exportBtn').click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^CSV$/ }) })
        .click();
    // Un octet par caractère (Windows-1252) : lu en latin1.
    const contenu = await fs.readFile(await (await telechargement).path(), 'latin1');
    const [entete, ...lignes] = contenu.split('\n');
    const colonnes = entete.split(';');
    const ligne = (cle) => {
        const l = (lignes.find(x => x.split(';').includes(`${cle} Csv ${s}`)) || '').split(';');
        return Object.fromEntries(colonnes.map((c, i) => [c, l[i]]));
    };

    /* DISCRIMINANT — LES QUATRE LIGNES SONT LÀ, avec leurs dates prévues
       dans les colonnes « Début » et « Fin ». Ferme « on lit une autre
       ligne » et donne le format des dates. Passe avant comme après. */
    expect(['A', 'B', 'C', 'E'].map(c => `${ligne(c).Début}→${ligne(c).Fin}`), 'les dates prévues').toEqual(
        ['08/06/2026→10/06/2026', '11/06/2026→15/06/2026', '01/06/2026→03/06/2026', '16/06/2026→17/06/2026']);

    // --- L'ASSERTION CENTRALE ---
    expect(colonnes, 'colonne « Début réel » absente du CSV').toContain('Début réel');
    expect(colonnes, 'colonne « Fin réelle » absente du CSV').toContain('Fin réelle');
    expect(colonnes.indexOf('Début réel'), '« Début réel » après la date de contrainte').toBe(colonnes.indexOf('Date de contrainte') + 1);
    expect(['A', 'B', 'C', 'E'].map(c => `${ligne(c)['Début réel']}→${ligne(c)['Fin réelle']}`), 'les dates réelles').toEqual(
        ['08/06/2026→10/06/2026', '11/06/2026→', '→', '16/06/2026→17/06/2026']);

    await page.locator('#msHelpOk').click();
    await expect(page.locator('#msHelpOk')).toBeHidden();
    await deleteActiveProject(page);
});
