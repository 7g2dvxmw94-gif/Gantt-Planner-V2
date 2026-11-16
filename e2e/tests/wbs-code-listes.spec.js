import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject, snapshotCustomization } from '../cleanup.js';

/* WBS, fonctionnalité F2 : le code WBS (F1, store.getWbs) s'affiche dans
 * le Gantt et dans le Tableau.
 *
 * L'ATTENDU.
 * - Gantt : un `span.task-wbs` par ligne, hors de `.task-name` (dont le
 *   `title` reste le nom seul), masqué sous 768 px.
 * - Tableau : une colonne « WBS », triable en ordre NATUREL (1.2 avant
 *   1.10).
 * - Le code se calcule sur l'arbre complet : une recherche masque des
 *   lignes, elle ne renumérote pas.
 * - Réglages > Général > « Afficher le code WBS dans le Gantt » masque le
 *   code du Gantt, pas la colonne du Tableau.
 *
 * LE JEU, importé en JSON : la phase A ⊃ A1…A11 ; la phase B ⊃ la phase
 * B1 ⊃ la tâche B1a. Codes attendus : A11 = 1.11, B1a = 2.1.1.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 4 failed, chacun sur sa première
 * assertion centrale (aucun code au Gantt, aucune colonne WBS, aucun
 * réglage). Les discriminants passent. */

function jeu(s) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E WbsCodeListes ${s}`, description: '' },
        tasks: [
            t('A', 0, { isPhase: true }),
            ...Array.from({ length: 11 }, (_, i) => t(`A${i + 1}`, i + 1, { parentId: 'jeu-A' })),
            t('B', 20, { isPhase: true }), t('B1', 21, { isPhase: true, parentId: 'jeu-B' }), t('B1a', 22, { parentId: 'jeu-B1' }),
        ],
        resources: [],
    };
}

const A = Array.from({ length: 11 }, (_, i) => `A${i + 1}`);

async function monter(page, s) {
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'wbs-code-listes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);
}

/** Le code WBS affiché au Gantt pour une clé (A11, B1a…), ou null. */
function codeGantt(page, cle, s) {
    return page.locator('.gantt-row').filter({ has: page.locator(`.task-name[title="${cle} ${s}"]`) }).locator('.task-wbs');
}

/** Les lignes du Tableau : [clé, code WBS] dans l'ordre affiché. */
async function lignesTableau(page, s) {
    return page.locator('#boardView tbody tr').evaluateAll((trs, s) => trs.map(tr => {
        const nom = tr.querySelector('.table-task-name')?.textContent || '';
        const m = nom.match(new RegExp(`(\\S+) ${s}`));
        return m ? [m[1], tr.querySelector('.table-wbs-col')?.textContent ?? null] : null;
    }).filter(Boolean), String(s));
}

test('Gantt : chaque ligne porte son code WBS, hors du nom, et une recherche ne renumérote pas', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);

    /* DISCRIMINANT — L'ARBRE EST CELUI DU JEU : A11 au niveau 2, B1a au
       niveau 3, et le `title` du nom est le nom seul. Ferme « le jeu n'a
       pas l'arbre voulu ». */
    const ligne = (cle) => page.locator('.gantt-row').filter({ has: page.locator(`.task-name[title="${cle} ${s}"]`) });
    await expect(ligne('A11'), 'A11 au niveau 2').toHaveAttribute('aria-level', '2');
    await expect(ligne('B1a'), 'B1a au niveau 3').toHaveAttribute('aria-level', '3');

    // --- L'ASSERTION CENTRALE ---
    await expect(codeGantt(page, 'A11', s), 'le code WBS de A11 au Gantt').toHaveText('1.11');
    await expect(codeGantt(page, 'B1a', s), 'le code WBS de B1a au Gantt').toHaveText('2.1.1');
    await expect(codeGantt(page, 'A', s), 'le code WBS de la phase A').toHaveText('1');
    /* Le code n'est pas dans le nom. */
    await expect(ligne('A11').locator('.task-name'), 'le nom reste le nom seul').toHaveText(`A11 ${s}`);

    /* Recherche « A11 » : les autres lignes sont masquées, A11 garde 1.11. */
    await page.locator('#searchInput').fill(`A11 ${s}`);
    await expect(ligne('A2'), 'la recherche masque A2').toBeHidden();
    await expect(codeGantt(page, 'A11', s), 'A11 garde son code sous la recherche').toHaveText('1.11');
    await page.locator('#searchInput').fill('');

    await deleteActiveProject(page);
});

test('Tableau : une colonne WBS, triée en ordre naturel', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await page.locator('#tabBoard').click();
    await expect(page.locator('#boardView tbody tr').first()).toBeVisible();

    const ordreWbs = [...A, 'B1a'];
    /* DISCRIMINANT — LE TRI PAR DÉFAUT N'EST PAS L'ORDRE WBS : le clic sur
       l'en-tête a donc quelque chose à prouver. */
    const avant = (await lignesTableau(page, s)).map(([k]) => k);
    expect(avant.slice().sort(), 'les douze tâches du jeu au Tableau').toEqual(ordreWbs.slice().sort());
    expect(avant, 'le tri par défaut diffère de l\'ordre WBS').not.toEqual(ordreWbs);

    // --- L'ASSERTION CENTRALE ---
    const entete = page.locator('#boardView th[data-sort-key="wbs"]');
    await expect(entete, 'en-tête « WBS » du Tableau').toHaveText('WBS');
    await entete.click();
    await expect.poll(async () => lignesTableau(page, s), { message: 'le Tableau trié par code WBS' })
        .toEqual([...A.map((k, i) => [k, `1.${i + 1}`]), ['B1a', '2.1.1']]);

    /* Recherche « A11 » : une seule ligne, qui garde 1.11 (le code se
       calcule sur l'arbre complet, pas sur les lignes affichées). */
    await page.locator('#searchInput').fill(`A11 ${s}`);
    await expect.poll(async () => lignesTableau(page, s), { message: 'Tableau : A11 garde son code sous la recherche' })
        .toEqual([['A11', '1.11']]);
    await page.locator('#searchInput').fill('');

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});

test('Réglage : masquer le code WBS du Gantt laisse la colonne du Tableau', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await snapshotCustomization(page);

    /* DISCRIMINANT — LE GANTT MONTRE DES LIGNES DU JEU. Ferme « plus aucun
       code parce que plus aucune ligne ». */
    await expect(page.locator(`.task-name[title="A11 ${s}"]`), 'A11 au Gantt').toBeVisible();

    await page.locator('#settingsBtn').click();
    await page.locator('.settings-tab[data-tab="general"]').click();
    // --- L'ASSERTION CENTRALE ---
    const reglage = page.locator('#settingsShowWbs');
    await expect(reglage, 'le réglage « Afficher le code WBS dans le Gantt »').toBeChecked();
    await expect(page.locator('.gantt-row .task-wbs').first(), 'des codes au Gantt avant de décocher').toBeAttached();
    /* La case est masquée sous son curseur : on clique le curseur, comme
       l'utilisateur. */
    await page.locator('label.settings-toggle', { has: reglage }).click();
    await expect(reglage, 'la case décochée').not.toBeChecked();
    await expect(page.locator('.gantt-row .task-wbs'), 'plus aucun code au Gantt').toHaveCount(0);
    await page.locator('#settingsSaveBtn').click();
    await page.locator('#toastContainer .toast', { hasText: 'Réglages enregistrés' }).waitFor({ timeout: 10_000 });

    /* La colonne du Tableau reste (le réglage ne concerne que le Gantt). */
    await page.locator('#tabBoard').click();
    await expect(page.locator('#boardView th[data-sort-key="wbs"]'), 'la colonne WBS du Tableau reste').toHaveCount(1);

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});

test('Mobile : à 375 px, le code WBS cède la place au nom', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);

    /* DISCRIMINANT — A11 EST AU GANTT. */
    await expect(page.locator(`.task-name[title="A11 ${s}"]`), 'A11 au Gantt').toBeVisible();

    // --- L'ASSERTION CENTRALE ---
    /* À 1 280 px, le code est visible : le masquage mesuré ensuite tient
       bien à la largeur, pas à une absence. */
    await expect(codeGantt(page, 'A11', s), 'le code de A11 visible à 1 280 px').toBeVisible();
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(codeGantt(page, 'A11', s), 'le code de A11 présent à 375 px').toHaveCount(1);
    await expect(codeGantt(page, 'A11', s), 'le code de A11 masqué à 375 px').toBeHidden();

    await page.setViewportSize({ width: 1280, height: 720 });
    await deleteActiveProject(page);
});
