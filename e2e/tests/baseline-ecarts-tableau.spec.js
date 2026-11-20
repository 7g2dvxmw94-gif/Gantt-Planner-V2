import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Le Tableau montre l'écart de DÉBUT et l'écart de FIN par rapport à la
 * baseline active, en jours OUVRÉS — comme la table « Variation » de
 * MS Project.
 *
 * LE BESOIN (demande de l'utilisateur, 20/11/2026) : saisir un début réel
 * recale la date de début (comportement de MS Project) ; le plan d'origine
 * est dans la baseline. Le Tableau montrait déjà « Début BL », « Fin BL »
 * et un seul « Écart », celui de la FIN, compté en jours CALENDAIRES : le
 * glissement du début ne se lisait pas, et un week-end comptait comme deux
 * jours de retard.
 *
 * LA RÈGLE : deux colonnes, « Écart début » et « Écart fin », après
 * « Fin BL ». Écart = nombre de jours ouvrés (calendrier du projet) entre
 * la date de la baseline et la date actuelle : +Nj en retard, -Nj en
 * avance, ±0j à l'heure.
 *
 * LE JEU (lundi 08/06/2026 ; calendrier lundi-vendredi) — baseline prise,
 * puis tâches déplacées :
 *   A  08 → 10/06  devient 11 → 15/06 : début +3j (9, 10, 11) ;
 *      fin +3j (11, 12, 15), et non +5j calendaires ;
 *   B  inchangée : ±0j, ±0j ;
 *   C  15 → 16/06  devient 12 → 12/06 : début -1j (15), et non -3j ;
 *      fin -2j (15, 16).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « en-tête « Écart début » absent du Tableau ». Les
 * discriminants — baseline active, colonnes « Début BL » et « Fin BL »
 * affichées, dates de A et C déplacées — passent. */

function jeu(s) {
    const t = (cle, ordre, debut, fin) => ({
        id: `jeu-${cle}`, name: `${cle} Ecarts ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [],
    });
    return {
        project: { id: 'jeu-projet', name: `E2E BaselineEcarts ${s}`, description: '' },
        tasks: [
            t('A', 0, '2026-06-08', '2026-06-10'),
            t('B', 1, '2026-06-01', '2026-06-03'),
            t('C', 2, '2026-06-15', '2026-06-16'),
        ],
        resources: [],
    };
}

async function tableau(page, s) {
    return page.locator('#boardView table').evaluate((table, s) => {
        const entetes = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        const lignes = {};
        for (const tr of table.querySelectorAll('tbody tr')) {
            const nom = tr.querySelector('.table-task-name')?.textContent || '';
            const m = nom.match(new RegExp(`^(\\S+) Ecarts ${s}$`));
            if (!m) continue;
            const cellules = [...tr.children].map(td => td.textContent.trim());
            lignes[m[1]] = Object.fromEntries(entetes.map((e, i) => [e, cellules[i]]));
        }
        return { entetes, lignes };
    }, String(s));
}

test('le Tableau montre l\'écart de début et l\'écart de fin à la baseline, en jours ouvrés', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'baseline-ecarts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);

    /* Baseline prise sur le plan importé, puis A et C déplacées. */
    const dates = await page.evaluate(async (s) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        await store.createBaseline('Plan initial');
        const id = (cle) => store.getTasks().find(t => t.name === `${cle} Ecarts ${s}`).id;
        store.updateTask(id('A'), { startDate: '2026-06-11', endDate: '2026-06-15' });
        store.updateTask(id('C'), { startDate: '2026-06-12', endDate: '2026-06-12' });
        await store.attendreEcritures();
        const lire = (cle) => { const t = store.getTask(id(cle)); return `${t.startDate}/${t.endDate}`; };
        return { actif: store.getActiveBaseline()?.name ?? null, A: lire('A'), C: lire('C') };
    }, String(s));

    /* DISCRIMINANTS — la baseline est active et les tâches ont bougé. Ferme
       « un écart nul parce que rien n'a bougé ». */
    expect(dates, 'baseline active, A et C déplacées').toEqual({ actif: 'Plan initial', A: '2026-06-11/2026-06-15', C: '2026-06-12/2026-06-12' });

    await page.locator('#tabBoard').click();
    await expect(page.locator('#boardView tbody tr').first()).toBeVisible();
    const vu = await tableau(page, s);
    expect(Object.keys(vu.lignes).sort(), 'les trois tâches sont au Tableau').toEqual(['A', 'B', 'C']);
    expect(vu.entetes, 'colonnes de la baseline affichées').toEqual(expect.arrayContaining(['Début BL', 'Fin BL']));

    // --- L'ASSERTION CENTRALE ---
    expect(vu.entetes, 'en-tête « Écart début » absent du Tableau').toContain('Écart début');
    expect(vu.entetes, 'en-tête « Écart fin »').toContain('Écart fin');
    const iFinBL = vu.entetes.indexOf('Fin BL');
    expect(vu.entetes.slice(iFinBL + 1, iFinBL + 3), 'après « Fin BL »').toEqual(['Écart début', 'Écart fin']);
    const L = vu.lignes;
    expect({
        A: [L.A['Écart début'], L.A['Écart fin']],
        B: [L.B['Écart début'], L.B['Écart fin']],
        C: [L.C['Écart début'], L.C['Écart fin']],
    }, 'écarts en jours ouvrés').toEqual({
        A: ['+3j', '+3j'],
        B: ['±0j', '±0j'],
        C: ['-1j', '-2j'],
    });

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
