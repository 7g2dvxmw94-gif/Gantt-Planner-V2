import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § C (vue Tableau) et § B12, sous l'angle des DATES
 * RÉELLES : le Tableau montre le Début réel et la Fin réelle de chaque
 * tâche, et se trie par elles.
 *
 * LE BESOIN. Les dates réelles se saisissent dans la fiche (R1, #158) et
 * pilotent le planning (R2, #159), mais aucune vue ne les montre : pour
 * savoir qu'une tâche a commencé, il faut ouvrir sa fiche.
 *
 * L'ATTENDU. Deux colonnes, « Début réel » et « Fin réelle », après « Fin »,
 * dans le format des autres dates ; « — » quand la date manque. Triables :
 * les tâches sans date réelle viennent APRÈS les autres, dans les deux
 * sens (une tâche non commencée n'est ni la plus tôt ni la plus tard).
 *
 * LE JEU, importé :
 *   A  08 → 10/06/2026, réel 08 → 10 ;
 *   B  11 → 15/06, commencée le 11 ;
 *   C  01 → 03/06, non commencée ;
 *   D  04 → 05/06, réel 04 → 05 ;
 *   E  16 → 17/06, Fin réelle 17 SEULE : la règle unique (datesReellesDe)
 *      lui donne pour Début réel son début prévu, le 16 — ce que le moteur
 *      ancre est ce qui s'affiche, pas le champ brut.
 * Chaque date réelle égale la date prévue du même bout : le test lit le
 * format attendu dans la colonne « Début » ou « Fin » de la même ligne,
 * sans le supposer.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « en-tête « Début réel » absent du Tableau ». Les discriminants
 * passent. */

function jeu(s) {
    const t = (cle, ordre, debut, fin, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} Tableau ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesTableau ${s}`, description: '' },
        tasks: [
            t('A', 0, '2026-06-08', '2026-06-10', { actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }),
            t('B', 1, '2026-06-11', '2026-06-15', { actualStart: '2026-06-11', progress: 40, status: 'in_progress' }),
            t('C', 2, '2026-06-01', '2026-06-03'),
            t('D', 3, '2026-06-04', '2026-06-05', { actualStart: '2026-06-04', actualFinish: '2026-06-05', progress: 100, status: 'done' }),
            t('E', 4, '2026-06-16', '2026-06-17', { actualFinish: '2026-06-17', progress: 100, status: 'done' }),
        ],
        resources: [],
    };
}

/** Le Tableau, ligne par ligne : { clé: { en-tête: texte } }, colonnes lues
 *  PAR EN-TÊTE (jamais par position), et l'ordre des clés. */
async function tableau(page, s) {
    return page.locator('#boardView table').evaluate((table, s) => {
        const entetes = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        const lignes = {};
        const ordre = [];
        for (const tr of table.querySelectorAll('tbody tr')) {
            const nom = tr.querySelector('.table-task-name')?.textContent || '';
            const m = nom.match(new RegExp(`^(\\S+) Tableau ${s}$`));
            if (!m) continue;
            ordre.push(m[1]);
            const cellules = [...tr.children].map(td => td.textContent.trim());
            lignes[m[1]] = Object.fromEntries(entetes.map((e, i) => [e, cellules[i]]));
        }
        return { entetes, lignes, ordre };
    }, String(s));
}

test('le Tableau montre le Début réel et la Fin réelle, et se trie par eux', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'dates-reelles-tableau.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    await page.locator('#tabBoard').click();
    await expect(page.locator('#boardView tbody tr').first()).toBeVisible();

    /* DISCRIMINANT — LES QUATRE TÂCHES SONT AU TABLEAU, avec leurs dates
       prévues, dans l'ordre par défaut (par nom). Ferme « une colonne vide
       parce que la ligne manque » et donne le format des dates, lu et non
       supposé. Passe avant comme après. */
    const avant = await tableau(page, s);
    expect(avant.ordre, 'les cinq tâches, triées par nom').toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const cle of ['A', 'B', 'C', 'D', 'E']) {
        expect(avant.lignes[cle].Début, `la date de début de ${cle} est affichée`).toMatch(/2026/);
    }

    // --- L'ASSERTION CENTRALE ---
    expect(avant.entetes, 'en-tête « Début réel » absent du Tableau').toContain('Début réel');
    expect(avant.entetes, 'en-tête « Fin réelle » absent du Tableau').toContain('Fin réelle');
    expect(avant.entetes.indexOf('Début réel'), '« Début réel » vient après « Fin »').toBe(avant.entetes.indexOf('Fin') + 1);
    const L = avant.lignes;
    expect({
        A: [L.A['Début réel'], L.A['Fin réelle']], B: [L.B['Début réel'], L.B['Fin réelle']],
        C: [L.C['Début réel'], L.C['Fin réelle']], D: [L.D['Début réel'], L.D['Fin réelle']],
        E: [L.E['Début réel'], L.E['Fin réelle']],
    }, 'les dates réelles, au format des autres dates').toEqual({
        A: [L.A.Début, L.A.Fin], B: [L.B.Début, '—'], C: ['—', '—'], D: [L.D.Début, L.D.Fin], E: [L.E.Début, L.E.Fin],
    });

    /* Tri par Début réel : D (04), A (08), B (11), E (16), puis C, non
       commencée ; inversé : E, B, A, D, puis C, toujours après. */
    const entete = page.locator('#boardView th[data-sort-key="actualStart"]');
    await entete.click();
    await expect.poll(async () => (await tableau(page, s)).ordre, { message: 'tri par Début réel, croissant' }).toEqual(['D', 'A', 'B', 'E', 'C']);
    await page.locator('#boardView th[data-sort-key="actualStart"]').click();
    await expect.poll(async () => (await tableau(page, s)).ordre, { message: 'tri par Début réel, décroissant' }).toEqual(['E', 'B', 'A', 'D', 'C']);

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
