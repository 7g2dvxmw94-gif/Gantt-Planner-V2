import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F3a : un onglet « WBS » montre l'organigramme des
 * tâches.
 *
 * L'ATTENDU.
 * - Onglet #tabWbs, en dernier ; vue #wbsView ; 6ᵉ bouton de la
 *   navigation mobile.
 * - Disposition : les nœuds de niveau 1 — feuille OU phase — en boîtes
 *   côte à côte ; sous chacun, ses descendants en liste indentée. Pas de
 *   colonne de feuilles à part : l'ordre du DOM des treeitem est l'ordre
 *   des codes.
 * - Une boîte : code, nom, dates, avancement (jalon : Franchi / Non
 *   franchi ; permis : statut ; phase : son avancement, celui du Gantt).
 *   Boîte projet en tête, hors de l'arbre, avec l'avancement du projet.
 * - Double-clic, Entrée ou « Ouvrir la fiche » ouvrent la fiche.
 * - Tout texte passe par textContent : un nom n'est jamais du HTML.
 *
 * LE JEU, importé en JSON (ordre entre parenthèses) : L (0, feuille racine
 * AVANT une phase, 26–29 mai, 100 %) ; la phase A (1) ⊃ A1 (2, 1er–5 juin,
 * 40 %), A2 (3, jalon le 19 juin, 100 %) ; la phase B (4) ⊃ la phase B1
 * (5) ⊃ B1a (6, sans dates), B2 (7, permis en instruction, 22 juin–31
 * juillet) ; T (8, 8–12 juin, 10 %).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 5 failed (tests 1 à 5), chacun
 * sur « onglet WBS absent » ; le test 6 (garde mobile) passe avant comme
 * après. Les discriminants passent. */

function jeu(s, extra = []) {
    const t = (cle, ordre, plus = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${s}`, description: '', startDate: '2026-06-08', endDate: '2026-06-12',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...plus,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E WbsOrganigramme ${s}`, description: '' },
        tasks: [
            t('L', 0, { startDate: '2026-05-26', endDate: '2026-05-29', progress: 100 }),
            t('A', 1, { isPhase: true }),
            t('A1', 2, { parentId: 'jeu-A', startDate: '2026-06-01', endDate: '2026-06-05', progress: 40 }),
            t('A2', 3, { parentId: 'jeu-A', isMilestone: true, startDate: '2026-06-19', endDate: '2026-06-19', progress: 100 }),
            t('B', 4, { isPhase: true }),
            t('B1', 5, { isPhase: true, parentId: 'jeu-B' }),
            t('B1a', 6, { parentId: 'jeu-B1', startDate: '', endDate: '' }),
            t('B2', 7, { parentId: 'jeu-B', isPermit: true, permitStatus: 'under_review', startDate: '2026-06-22', endDate: '2026-07-31' }),
            t('T', 8, { progress: 10 }),
            ...extra.map(f => f(t)),
        ],
        resources: [],
    };
}

async function monter(page, s, extra) {
    const donnees = jeu(s, extra);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'wbs-organigramme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }), 'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    await trackActiveProject(page);
    await expect(page.locator('#tabTimeline'), 'la vue active est le Gantt').toHaveAttribute('aria-selected', 'true');

    /* DISCRIMINANT COMMUN — L'ARBRE IMPORTÉ EST CELUI QU'ON CROIT, lu au
       Gantt (clé et niveau). Ferme « un ordre faux viendrait du jeu ». */
    const lignes = await page.locator('.gantt-row').evaluateAll((rows, s) => rows.map(r => {
        const nom = r.querySelector('.task-name')?.title || '';
        const m = nom.match(new RegExp(`^(\\S+) ${s}$`));
        return m ? `${m[1]}:${r.getAttribute('aria-level')}` : null;
    }).filter(Boolean), String(s));
    expect(lignes, 'l\'arbre du Gantt').toEqual(['L:1', 'A:1', 'A1:2', 'A2:2', 'B:1', 'B1:2', 'B1a:3', 'B2:2', 'T:1']);
}

async function ouvrirWbs(page) {
    await expect(page.locator('#tabWbs'), 'onglet WBS absent').toHaveCount(1);
    await page.locator('#tabWbs').click();
    await expect(page.locator('#wbsView [role="tree"]'), 'organigramme absent').toHaveCount(1);
}

/** Le treeitem d'une clé (L, A1…). */
function boite(page, cle, s) {
    return page.locator('#wbsView [role="treeitem"]').filter({ has: page.locator(`:scope > .wbs-boite .wbs-nom[title="${cle} ${s}"]`) });
}

async function finir(page) {
    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
}

test('organigramme : les boîtes suivent l\'ordre des codes, feuille racine comprise', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);

    // --- L'ASSERTION CENTRALE ---
    const sequence = await page.locator('#wbsView [role="treeitem"]').evaluateAll((lis, s) => lis.map(li => {
        const nom = li.querySelector(':scope > .wbs-boite .wbs-nom')?.textContent || '';
        return `${li.dataset.wbsCode} ${nom.replace(` ${s}`, '')} ${li.getAttribute('aria-level')}`;
    }), String(s));
    expect(sequence, 'les treeitem dans l\'ordre du DOM').toEqual([
        '1 L 1', '2 A 1', '2.1 A1 2', '2.2 A2 2', '3 B 1', '3.1 B1 2', '3.1.1 B1a 3', '3.2 B2 2', '4 T 1',
    ]);
    const racines = await page.locator('#wbsView [role="tree"] > [role="treeitem"]').evaluateAll(lis => lis.map(li => li.dataset.wbsCode));
    expect(racines, 'les enfants directs de l\'arbre').toEqual(['1', '2', '3', '4']);
    /* L, feuille racine, est une boîte de niveau 1 à sa place : même ligne
       que A, à sa gauche. Ferme « une colonne de feuilles à part ». */
    const bL = await boite(page, 'L', s).locator(':scope > .wbs-boite').boundingBox();
    const bA = await boite(page, 'A', s).locator(':scope > .wbs-boite').boundingBox();
    expect(Math.round(bL.y), 'L sur la ligne de A').toBe(Math.round(bA.y));
    expect(bL.x < bA.x, 'L à gauche de A').toBe(true);

    await finir(page);
});

test('organigramme : chaque boîte montre ses dates et son avancement', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    /* DISCRIMINANT — L'avancement de la phase A au Gantt : le même nombre
       doit se lire dans sa boîte (une seule règle d'avancement). */
    const barreA = await page.locator(`.gantt-bar.phase-bar[aria-label^="Phase A ${s}:"]`).getAttribute('aria-label');
    const pctA = (barreA || '').match(/(\d+)%/)?.[1];
    expect(pctA, `avancement de A au Gantt (${barreA})`).toBe('70');

    await ouvrirWbs(page);
    // --- L'ASSERTION CENTRALE ---
    const lire = async (cle) => {
        const b = boite(page, cle, s);
        await expect(b, `boîte ${cle}`).toHaveCount(1);
        return {
            dates: await b.locator(':scope > .wbs-boite .wbs-dates').textContent(),
            etat: await b.locator(':scope > .wbs-boite .wbs-etat-texte').textContent(),
        };
    };
    expect(await lire('L'), 'L').toEqual({ dates: '26 mai 2026 → 29 mai 2026', etat: '100%' });
    expect(await lire('A'), 'A, comme au Gantt').toEqual({ dates: '1 juin 2026 → 19 juin 2026', etat: `${pctA}%` });
    expect(await lire('A1'), 'A1').toEqual({ dates: '1 juin 2026 → 5 juin 2026', etat: '40%' });
    expect(await lire('A2'), 'A2, jalon').toEqual({ dates: '19 juin 2026', etat: 'Franchi' });
    expect(await lire('B'), 'B').toEqual({ dates: '22 juin 2026 → 31 juil. 2026', etat: '0%' });
    expect((await lire('B1a')).dates, 'B1a, sans dates').toBe('—');
    expect((await lire('B2')).etat, 'B2, permis').toBe('En instruction');
    await expect(page.locator('#wbsView .wbs-projet-nom'), 'boîte projet').toHaveText(`E2E WbsOrganigramme ${s}`);
    await expect(page.locator('#wbsView .wbs-projet-avancement'), 'avancement du projet').toHaveText('42%');
    await expect(boite(page, 'A1', s), 'nom accessible de A1')
        .toHaveAttribute('aria-label', `2.1 A1 ${s}, du 1 juin 2026 au 5 juin 2026, 40%`);

    await finir(page);
});

test('organigramme : double-clic, Entrée ou « Ouvrir la fiche » ouvrent la fiche', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);

    // --- L'ASSERTION CENTRALE ---
    const a1 = boite(page, 'A1', s);
    await expect(a1, 'boîte A1').toHaveCount(1);
    /* Un seul arrêt de tabulation dans l'arbre dès l'ouverture, sur la
       première boîte (motif d'arbre de l'APG ARIA). */
    expect(await page.locator('#wbsView [role="treeitem"][tabindex="0"]').count(), 'un seul tabindex=0 à l\'ouverture').toBe(1);
    await expect(page.locator('#wbsView [role="treeitem"]').first(), 'la première boîte est l\'arrêt de tabulation').toHaveAttribute('tabindex', '0');
    const ouverte = async (comment) => {
        await expect(page.locator('#taskModalOverlay'), `fiche ouverte (${comment})`).toBeVisible();
        await expect(page.locator('#taskName'), `fiche de A1 (${comment})`).toHaveValue(`A1 ${s}`);
        await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
        await expect(page.locator('#taskModalOverlay')).toBeHidden();
    };
    await a1.locator(':scope > .wbs-boite').dblclick();
    await ouverte('double-clic');

    await a1.locator(':scope > .wbs-boite .wbs-nom').click();
    await expect(a1, 'A1 focalisée après le clic').toBeFocused();
    await expect(a1, 'A1 sélectionnée').toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await ouverte('Entrée');

    await a1.locator(':scope > .wbs-boite .wbs-nom').click();
    const bouton = a1.getByRole('button', { name: /Ouvrir la fiche/ });
    await expect(bouton, 'bouton Ouvrir la fiche absent').toHaveCount(1);
    await expect(bouton, 'le bouton hors de la tabulation').toHaveAttribute('tabindex', '-1');
    await bouton.click();
    await ouverte('bouton');

    /* Toujours un seul arrêt de tabulation après la sélection. */
    expect(await page.locator('#wbsView [role="treeitem"][tabindex="0"]').count(), 'un seul tabindex=0 après sélection').toBe(1);

    await finir(page);
});

test('organigramme : un nom qui ressemble à du HTML s\'affiche tel quel', async ({ page }) => {
    const s = Date.now();
    /* Sans charge active : des chevrons, une esperluette et des
       guillemets suffisent à montrer qu'un nom arrive intact. */
    const nom = `Étanchéité <MOA> & "lot" ${s}`;
    await monter(page, s, [(t) => ({ ...t('X', 9), name: nom })]);

    /* DISCRIMINANT — le nom est intact au Gantt : ferme « mutilé à la
       saisie ou à l'import ». */
    await expect(page.locator('.gantt-row .task-name').filter({ hasText: '<MOA>' }), 'nom intact au Gantt').toHaveAttribute('title', nom);

    await ouvrirWbs(page);
    // --- L'ASSERTION CENTRALE ---
    const x = page.locator('#wbsView .wbs-nom').filter({ hasText: '<MOA>' });
    await expect(x, 'boîte du nom à chevrons').toHaveCount(1);
    await expect(x, 'textContent intact').toHaveText(nom);
    await expect(x, 'title intact').toHaveAttribute('title', nom);
    expect(await page.locator('#wbsView moa').count(), 'aucun élément <moa> créé').toBe(0);

    await finir(page);
});

test('organigramme : revenir au Gantt masque la vue WBS', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await ouvrirWbs(page);
    // --- L'ASSERTION CENTRALE ---
    await expect(page.locator('.gantt-wrapper'), 'Gantt masqué sous la vue WBS').toBeHidden();
    await page.locator('#tabTimeline').click();
    await expect(page.locator('#wbsView'), 'vue WBS masquée').toBeHidden();
    await expect(page.locator('.gantt-wrapper'), 'Gantt de retour').toBeVisible();
    await deleteActiveProject(page);
});

test('garde mobile : la navigation du bas tient à 320, 360 et 375 px, un bouton par onglet', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
    for (const largeur of [320, 360, 375]) {
        await page.setViewportSize({ width: largeur, height: 740 });
        const m = await page.evaluate(() => {
            const nav = document.querySelector('.mobile-nav-items');
            return {
                navDeborde: nav ? nav.scrollWidth - nav.clientWidth : -1,
                pageDeborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                boutons: document.querySelectorAll('.mobile-nav-item').length,
                onglets: document.querySelectorAll('.toolbar button.tab[role="tab"]').length,
            };
        });
        expect(m.navDeborde, `navigation du bas sans débordement à ${largeur} px`).toBe(0);
        expect(m.pageDeborde, `page sans défilement horizontal à ${largeur} px`).toBe(0);
        expect(m.boutons, `un bouton par onglet à ${largeur} px`).toBe(m.onglets);
    }
});
