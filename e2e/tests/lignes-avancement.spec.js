import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Lignes d'avancement (D3), comme dans MS Project.
 *
 * LE BESOIN (demande de l'utilisateur : « je veux qq chose comme dans
 * MSP » pour sa date d'état hebdomadaire). La ligne d'avancement part du
 * trait de la date d'état et, pour chaque tâche, va pointer l'avancement
 * réel sur sa barre : à gauche du trait, la tâche est en retard ; à
 * droite, en avance. Un zigzag qui se lit d'un coup d'œil.
 *
 * LA RÈGLE :
 *   - option « Lignes d'avancement » dans le panneau « Date d'état »,
 *     désactivée par défaut ;
 *   - date de référence : la date d'état du projet (à défaut, aujourd'hui),
 *     fin du jour, comme le trait de D1 ;
 *   - le point d'une tâche est sur sa barre prévue, à son % achevé ;
 *     une tâche achevée, ou pas commencée et prévue après la date d'état,
 *     reste sur le trait ; un jalon non atteint dont la date est passée
 *     pointe sa date ; une phase n'a pas de point.
 *
 * Jeu, date d'état au 10/06/2026 :
 *   R 01/06→19/06, 10 %  → en retard : point à gauche du trait ;
 *   A 08/06→26/06, 80 %  → en avance : point à droite ;
 *   F 20/06→25/06, 0 %   → future : sur le trait ;
 *   T 01/06→05/06, 100 % → achevée : sur le trait.
 *
 * L'option est un réglage du compte de test partagé : elle est remise à
 * « désactivée » à la fin.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « option Lignes d'avancement dans le panneau Date d'état ».
 * Les discriminants passent. */

function jeu(s) {
    const tache = (id, nom, debut, fin, progress, order) => ({
        id, name: `${nom} Avct ${s}`, description: '', startDate: debut, endDate: fin,
        progress, priority: 'medium', status: progress >= 100 ? 'done' : (progress > 0 ? 'in_progress' : 'todo'),
        color: '#6366F1', order, parentId: null,
        isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [],
    });
    return {
        project: { id: 'jeu-projet', name: `E2E LignesAvancement ${s}`, description: '' },
        tasks: [
            tache('jeu-r', 'R', '2026-06-01', '2026-06-19', 10, 0),
            tache('jeu-a', 'A', '2026-06-08', '2026-06-26', 80, 1),
            tache('jeu-f', 'F', '2026-06-20', '2026-06-25', 0, 2),
            tache('jeu-t', 'T', '2026-06-01', '2026-06-05', 100, 3),
        ],
        resources: [],
    };
}

const poserDateEtat = (page, iso) => page.evaluate(async (iso) => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    const p = store.getActiveProject();
    return store.setProjectDates(p.id, { statusDate: iso, deadline: p.deadline || null });
}, iso);

/** Position du trait de date d'état, et point de chaque tâche (par nom). */
const relever = (page) => page.evaluate(() => {
    const trait = document.querySelector('.gantt-body .gantt-timeline-cell .date-etat-ligne');
    const couche = document.querySelector('.gantt-body .gantt-lignes-avancement');
    const points = {};
    if (couche) {
        couche.querySelectorAll('[data-task-id]').forEach(p => {
            const ligne = document.querySelector(`.gantt-body .gantt-row[data-task-id="${p.dataset.taskId}"] .task-name`);
            const nom = ligne ? ligne.getAttribute('title').split(' ')[0] : p.dataset.taskId;
            points[nom] = parseFloat(p.getAttribute('cx'));
        });
    }
    return {
        trait: trait ? parseFloat(trait.style.left) : null,
        couche: !!couche,
        ligne: !!(couche && couche.querySelector('polyline')),
        points,
    };
});

const regler = async (page, actif) => {
    await page.locator('#dateEtatBtn').click();
    const caseLignes = page.locator('#dateEtatPopover #lignesAvancementCase');
    if (await caseLignes.count()) {
        if ((await caseLignes.isChecked()) !== actif) await caseLignes.click();
    }
    await page.keyboard.press('Escape');
};

test('lignes d\'avancement : du trait de la date d\'état au % achevé de chaque tâche', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);

    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'lignes-avancement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    await page.locator('#tabTimeline').click();
    const zoomJour = page.locator('.zoom-btn[data-zoom="day"]');
    await zoomJour.click();
    await expect(zoomJour, 'le zoom « jour » est actif').toHaveClass(/active/);

    /* DISCRIMINANT — LA DATE D'ÉTAT EST POSÉE ET TRACÉE (D1). */
    expect(await poserDateEtat(page, '2026-06-10'), 'date d\'état écrite').toBe(true);
    await expect.poll(async () => (await relever(page)).trait, { message: 'le trait de la date d\'état est tracé' }).not.toBeNull();

    /* DISCRIMINANT — PAR DÉFAUT, PAS DE LIGNE D'AVANCEMENT. */
    await regler(page, false);
    await expect.poll(async () => (await relever(page)).couche, { message: 'désactivée, pas de ligne' }).toBe(false);

    // --- L'ASSERTION CENTRALE ---
    await page.locator('#dateEtatBtn').click();
    await expect(page.locator('#dateEtatPopover #lignesAvancementCase'),
        'option Lignes d\'avancement dans le panneau Date d\'état').toHaveCount(1);
    await page.keyboard.press('Escape');

    await regler(page, true);
    await expect.poll(async () => (await relever(page)).ligne, { message: 'activée, la ligne est tracée' }).toBe(true);
    await expect.poll(async () => Object.keys((await relever(page)).points).sort(), { message: 'un point par tâche' })
        .toEqual(['A', 'F', 'R', 'T']);
    const m = await relever(page);
    expect(m.points.R, 'R, en retard : à gauche du trait').toBeLessThan(m.trait - 1);
    expect(m.points.A, 'A, en avance : à droite du trait').toBeGreaterThan(m.trait + 1);
    expect(Math.abs(m.points.F - m.trait), 'F, future : sur le trait').toBeLessThanOrEqual(1);
    expect(Math.abs(m.points.T - m.trait), 'T, achevée : sur le trait').toBeLessThanOrEqual(1);

    /* L'option se désactive, et reste désactivée pour les autres tests. */
    await regler(page, false);
    await expect.poll(async () => (await relever(page)).couche, { message: 'désactivée à nouveau' }).toBe(false);

    await deleteActiveProject(page);
});
