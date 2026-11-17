import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G4 (export MS Project), sous l'angle des DATES
 * RÉELLES : l'export XML écrit le Début réel et la Fin réelle de chaque
 * tâche, comme MS Project les lit.
 *
 * LE BESOIN. Les dates réelles pilotent le planning (#158 à #162), mais
 * l'export MS Project les perd : le fichier ouvert dans MS Project arrive
 * sans aucune tâche commencée, et son moteur la replace.
 *
 * LE FORMAT (schéma MSPDI, élément Task) : <ActualStart> et
 * <ActualFinish>, qui suivent <PercentComplete> dans la séquence de
 * <Task> et précèdent <ConstraintType> et <PredecessorLink>. L'heure suit
 * celle des dates de la tâche à l'export : 08:00 pour un début, 17:00 pour
 * une fin. Rien quand la date manque. Les valeurs passent par la règle
 * unique, datesReellesDe : une Fin réelle seule a pour Début réel le début
 * prévu.
 *
 * LE JEU, importé :
 *   P  phase ⊃ A (08 → 10/06, réel 08 → 10, 100 %), B (11 → 15/06,
 *      commencée le 11, 40 %, « Début au plus tôt le 11/06 ») ; la phase
 *      reçoit son réel de ses enfants à l'import (#162) : 08 → — ;
 *   C  01 → 03/06, non commencée ;
 *   E  16 → 17/06, Fin réelle 17 SEULE, 100 %.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « ActualStart absent du bloc de A ». Les discriminants
 * passent. */

function jeu(s) {
    const t = (cle, ordre, debut, fin, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} Export ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReellesExportXml ${s}`, description: '' },
        tasks: [
            t('P', 0, '2026-06-08', '2026-06-15', { isPhase: true }),
            t('A', 1, '2026-06-08', '2026-06-10', { parentId: 'jeu-P', actualStart: '2026-06-08', actualFinish: '2026-06-10', progress: 100, status: 'done' }),
            t('B', 2, '2026-06-11', '2026-06-15', { parentId: 'jeu-P', actualStart: '2026-06-11', progress: 40, status: 'in_progress',
                constraintType: 'SNET', constraintDate: '2026-06-11' }),
            t('C', 3, '2026-06-01', '2026-06-03'),
            t('E', 4, '2026-06-16', '2026-06-17', { actualFinish: '2026-06-17', progress: 100, status: 'done' }),
        ],
        resources: [],
    };
}

/** Les blocs <Task>…</Task>, indexés par la clé du nom. */
function blocsParCle(xml, s) {
    const index = {};
    for (const bloc of xml.match(/<Task>[\s\S]*?<\/Task>/g) || []) {
        const nom = (bloc.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1] || '';
        const m = nom.match(new RegExp(`^(\\S+) Export ${s}$`));
        if (m) index[m[1]] = bloc;
    }
    return index;
}

test('l\'export MS Project écrit le Début réel et la Fin réelle, à leur rang', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'dates-reelles-export-xml.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* DISCRIMINANT — LES RÉELS SONT DANS LE STORE, la phase comprise. Ferme
       « il n'y a rien à exporter ». */
    const store = await page.evaluate(async (s) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return ['P', 'A', 'B', 'C', 'E'].map(c => {
            const t = store.getTasks().find(x => x.name === `${c} Export ${s}`);
            return t ? `${c}:${t.actualStart ?? '—'}→${t.actualFinish ?? '—'}` : `${c}:absente`;
        }).join(' ');
    }, String(s));
    expect(store, 'les réels dans le store').toBe('P:2026-06-08→— A:2026-06-08→2026-06-10 B:2026-06-11→— C:—→— E:—→2026-06-17');

    await page.locator('#exportBtn').click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^XML$/ }) })
        .click();
    const xml = await fs.readFile(await (await telechargement).path(), 'utf-8');
    const b = blocsParCle(xml, s);

    /* DISCRIMINANT — CHAQUE BLOC EST LÀ, avec son avancement, et B porte sa
       contrainte. Ferme « on lit un autre bloc » et donne les repères de
       rang : <PercentComplete> avant, <ConstraintType> après. */
    expect(Object.keys(b).sort(), 'les cinq blocs').toEqual(['A', 'B', 'C', 'E', 'P']);
    expect(b.A, 'avancement de A').toContain('<PercentComplete>100</PercentComplete>');
    expect(b.B, 'contrainte de B').toContain('<ConstraintType>4</ConstraintType>');

    // --- L'ASSERTION CENTRALE ---
    expect(b.A, 'ActualStart absent du bloc de A').toContain(
        '<PercentComplete>100</PercentComplete><ActualStart>2026-06-08T08:00:00</ActualStart><ActualFinish>2026-06-10T17:00:00</ActualFinish>');
    expect(b.B, 'B : Début réel, puis la contrainte').toContain(
        '<PercentComplete>40</PercentComplete><ActualStart>2026-06-11T08:00:00</ActualStart><ConstraintType>4</ConstraintType>');
    expect(b.B, 'B, non finie : pas de Fin réelle').not.toContain('<ActualFinish>');
    expect(b.P, 'la phase : son Début réel, tiré des enfants').toContain('<ActualStart>2026-06-08T08:00:00</ActualStart>');
    expect(b.P, 'la phase, non finie : pas de Fin réelle').not.toContain('<ActualFinish>');
    expect(b.C, 'C, non commencée : aucun réel').not.toMatch(/<Actual(Start|Finish)>/);
    expect(b.E, 'E : Fin réelle seule, Début réel au début prévu').toContain(
        '<ActualStart>2026-06-16T08:00:00</ActualStart><ActualFinish>2026-06-17T17:00:00</ActualFinish>');

    await deleteActiveProject(page);
});
