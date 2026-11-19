import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* TEST_PLAN.md § A7, étape 2 : la date d'état se voit sur le Gantt.
 *
 * LE BESOIN (demande de l'utilisateur : « comme dans MS Project »). La
 * date d'état, mise à jour chaque semaine, est le jour où l'on fait le
 * point. MS Project la trace sur le Gantt par un trait vertical, distinct
 * de celui du jour. Ici, rien ne la montrait.
 *
 * LA RÈGLE : quand le projet a une date d'état, chaque ligne du Gantt
 * porte un trait vertical pointillé (.date-etat-ligne) à la FIN du jour
 * d'état — le point est fait « au soir du » 10/06, travail du 10 compris,
 * comme la date d'état de MS Project. Il suit la date quand elle change et
 * disparaît quand elle est effacée (vide : la date du jour, déjà tracée
 * par la ligne « aujourd'hui »).
 *
 * LE JEU, importé : W du jeudi 11 au vendredi 12/06/2026. Le bord gauche
 * de sa barre est la fin du 10/06 : c'est là que doit tomber le trait.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « une ligne de date d'état par ligne du Gantt » : 0. Les
 * discriminants — le zoom « jour », la ligne « aujourd'hui » rendue, la
 * date d'état écrite — passent. */

function jeu(suffixe) {
    return {
        project: { id: 'jeu-projet', name: `E2E DateEtatGantt ${suffixe}`, description: '' },
        tasks: [{
            id: 'jeu-w', name: `W Etat ${suffixe}`, description: '', startDate: '2026-06-11', endDate: '2026-06-12',
            progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order: 0, parentId: null,
            isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [],
        }],
        resources: [],
    };
}

const poserDateEtat = (page, iso) => page.evaluate(async (iso) => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    const p = store.getActiveProject();
    return store.setProjectDates(p.id, { statusDate: iso, deadline: p.deadline || null });
}, iso);

/** Lignes du Gantt, lignes de date d'état, et leurs positions. */
const relever = (page, nomW) => page.evaluate((nomW) => {
    const cellules = [...document.querySelectorAll('.gantt-body .gantt-timeline-cell')];
    const lignes = [...document.querySelectorAll('.gantt-body .gantt-timeline-cell .date-etat-ligne')];
    const barreW = [...document.querySelectorAll('.gantt-body .gantt-bar')].find(b => b.textContent.includes(nomW));
    return {
        cellules: cellules.length,
        lignes: lignes.length,
        positions: [...new Set(lignes.map(l => parseFloat(l.style.left)))],
        bordW: barreW ? parseFloat(barreW.style.left) : null,
        aujourdhui: document.querySelectorAll('.gantt-body .today-line').length,
    };
}, nomW);

test('la date d\'état est tracée sur le Gantt, à la fin du jour d\'état, et suit ses changements', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const nomW = donnees.tasks[0].name;

    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'date-etat-gantt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
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
    /* DISCRIMINANT — ZOOM « JOUR » (relu des réglages du compte partagé). */
    await expect(zoomJour, 'le zoom « jour » est actif').toHaveClass(/active/);

    /* DISCRIMINANT — SANS DATE D'ÉTAT, AUCUN TRAIT ; le Gantt est rendu
       (ligne « aujourd'hui » dans chaque ligne). Ferme « le trait serait
       posé sans date ». */
    const sans = await relever(page, nomW);
    expect(sans.cellules, 'le Gantt a des lignes').toBeGreaterThan(0);
    expect(sans.aujourdhui, 'la ligne « aujourd\'hui » est rendue').toBe(sans.cellules);
    expect(sans.lignes, 'sans date d\'état, pas de trait').toBe(0);

    /* DISCRIMINANT — LA DATE D'ÉTAT EST ÉCRITE. */
    expect(await poserDateEtat(page, '2026-06-10'), 'date d\'état écrite').toBe(true);

    // --- L'ASSERTION CENTRALE ---
    await expect.poll(async () => (await relever(page, nomW)).lignes,
        { message: 'une ligne de date d\'état par ligne du Gantt' }).toBe(sans.cellules);
    const au10 = await relever(page, nomW);
    expect(au10.bordW, 'la barre de W est rendue').not.toBeNull();
    expect(au10.positions, 'le trait tombe à la fin du 10/06, bord gauche de W (11/06)').toEqual([au10.bordW]);

    /* Il suit la date : au 12/06, deux colonnes plus loin. */
    const colonne = await page.locator('.gantt-timeline-grid-col').first().evaluate(el => el.getBoundingClientRect().width);
    expect(await poserDateEtat(page, '2026-06-12')).toBe(true);
    await expect.poll(async () => (await relever(page, nomW)).positions, { message: 'le trait suit la date d\'état' })
        .toEqual([au10.bordW + 2 * colonne]);

    /* Effacée : le trait disparaît. */
    expect(await poserDateEtat(page, null)).toBe(true);
    await expect.poll(async () => (await relever(page, nomW)).lignes, { message: 'effacée, plus de trait' }).toBe(0);

    await deleteActiveProject(page);
});
