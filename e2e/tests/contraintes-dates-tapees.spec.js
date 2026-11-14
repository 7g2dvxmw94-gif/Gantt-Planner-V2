import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B11 (contraintes de date dans la fiche) : les
 * dates tapées dans la fiche emmènent la contrainte de leur bout.
 *
 * LE BESOIN. Glisser une « Doit finir le » emmène sa date (PR 14) ; taper
 * un nouveau début dans la fiche, non : la tâche revient sur sa contrainte
 * à l'enregistrement, et la saisie est perdue sans un mot.
 *
 * LA RÈGLE (plan v4, § 3.8), la même que pour le glisser
 * (contrainteApresDeplacement) :
 *   - début tapé : la tâche se déplace ; une contrainte de début prend le
 *     début, une contrainte de fin prend la fin que la fiche affiche ;
 *   - fin tapée seule : seule une contrainte de fin suit ;
 *   - durée tapée seule : aucune contrainte ne bouge ;
 *   - type ou date de contrainte modifiés dans la même fiche : la saisie
 *     fait foi.
 * L'aperçu de la fiche annonce, avant d'enregistrer, le lien que cela
 * romprait.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 3 failed, chacun sur son
 * assertion centrale. Les discriminants passent. JUIN 2026 COMMENCE UN
 * LUNDI. */

function jeu(suffixe, nomJeu, taches) {
    const tache = ([id, name, startDate, endDate, extra = {}], ordre) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ContraintesDatesTapees ${nomJeu} ${suffixe}`, description: '' },
        tasks: [['jeu-w', 'W Témoin', '2026-06-05', '2026-06-09'], ...taches].map(tache),
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** L'identifiant d'une tâche, lu dans le store par son nom (le compte est
 *  partagé : on filtre par nom, et il en faut exactement une). */
async function idDe(page, nom) {
    const ids = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getTasks().filter(t => t.name === nom).map(t => t.id);
    }, nom);
    expect(ids, `une seule tâche « ${nom} »`).toHaveLength(1);
    return ids[0];
}
/* La barre ou le losange : un jalon ne porte pas son nom. */
const barreDe = async (page, nom) => page.locator(`.gantt-timeline-cell [data-task-id="${await idDe(page, nom)}"]`);
const ligneDe = async (page, nom) => page.locator(`.gantt-row[data-task-id="${await idDe(page, nom)}"]`);

/** Dates et contrainte des tâches nommées, lues dans le store VIVANT. */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        return {
            projet: store.getActiveProject()?.name ?? null,
            pile: store._undoStack ? store._undoStack.length : null,
            etat: Object.fromEntries(noms.map(n => {
                const t = taches.filter(x => x.name === n);
                if (t.length !== 1) return [n, `${t.length} tâche(s)`];
                const c = t[0].constraintType ? ` ${t[0].constraintType} ${t[0].constraintDate}` : '';
                return [n, `${t[0].startDate}→${t[0].endDate}${c}`];
            })),
        };
    }, noms);
}

/** Importe le jeu, attend le projet actif, puis pose et relit la vue Gantt
 *  au zoom « jour » (relu des réglages du compte partagé). */
async function monter(page, donnees, fichier) {
    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: fichier, mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT D1 — LE GANTT, AU ZOOM « JOUR ». Ferme « une colonne
       n'est pas un jour » : le nombre de colonnes glissées ne dirait rien. */
    await expect(await present(page.locator('#tabTimeline'), 'onglet de la vue Gantt'),
        'la vue active n\'est pas le Gantt').toHaveAttribute('aria-selected', 'true');
    const zoomJour = await present(page.locator('.zoom-btn[data-zoom="day"]'), 'bouton de zoom « jour »');
    await zoomJour.click();
    await expect(zoomJour).toHaveClass(/active/);
}

const fiche = (page) => page.locator('#taskModalOverlay');
const fs = (taskId) => ({ dependencies: [{ taskId, type: 'FS', lag: 0 }] });

/** Ouvre la fiche d'une tâche par un double-clic sur sa barre. */
async function ouvrir(page, nom) {
    const barre = await present(await barreDe(page, nom), `barre de « ${nom} »`);
    await barre.scrollIntoViewIfNeeded();
    await barre.dblclick();
    await expect(page.locator('#taskName'), `la fiche ouverte est celle de « ${nom} »`).toHaveValue(nom);
}
async function enregistrer(page) {
    await (await present(fiche(page).getByRole('button', { name: 'Enregistrer' }), 'bouton « Enregistrer »')).click();
    await expect(fiche(page), 'la fiche doit se fermer').toBeHidden({ timeout: 15_000 });
}

test('début tapé : la contrainte de chaque bout suit ; durée tapée : rien ne suit ; contrainte saisie : elle fait foi', async ({ page }) => {
    const s = Date.now();
    const mfo = { constraintType: 'MFO', constraintDate: '2026-06-17' };
    const donnees = jeu(s, 'Debut', [
        ['jeu-c', 'C Façade', '2026-06-15', '2026-06-17', mfo],
        ['jeu-m', 'M Toiture', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }],
        ['jeu-t', 'T Libre', '2026-06-15', '2026-06-17'],
        ['jeu-c2', 'C2 Menuiseries', '2026-06-15', '2026-06-17', mfo],
        ['jeu-c5', 'C5 Peintures', '2026-06-15', '2026-06-17', mfo],
    ]);
    const [, C, M, T, C2, C5] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-dates-tapees-1.json');

    /* DISCRIMINANT D1 — LA FICHE RECALCULE LA FIN : début 19/06 → fin
       23/06, durée 3, avant d'enregistrer. Ferme « la fiche n'a pas pris
       la saisie, ou n'a pas recalculé la fin ». */
    await ouvrir(page, C);
    await page.locator('#taskStart').fill('2026-06-19');
    await expect(page.locator('#taskEnd'), 'la fin suit le début').toHaveValue('2026-06-23');
    await expect(page.locator('#taskDuration'), 'la durée reste 3').toHaveValue('3');
    await enregistrer(page);
    const c = (await lire(page, [C])).etat[C];

    /* DISCRIMINANT D2 — UNE TÂCHE LIBRE, début tapé 19/06 → 19 → 23/06. */
    await ouvrir(page, T);
    await page.locator('#taskStart').fill('2026-06-19');
    await enregistrer(page);
    expect((await lire(page, [T])).etat[T], 'T : la date tapée s\'enregistre').toBe('2026-06-19→2026-06-23');

    /* DISCRIMINANT D3 — DURÉE TAPÉE SEULE : C2 (MFO 17/06), durée 5 → 11 →
       17/06, MFO 17/06. Ferme « toute fin modifiée emmène la contrainte,
       durée comprise ». */
    await ouvrir(page, C2);
    await page.locator('#taskDuration').fill('5');
    await enregistrer(page);
    expect((await lire(page, [C2])).etat[C2], 'C2 : la contrainte reste').toBe('2026-06-11→2026-06-17 MFO 2026-06-17');

    /* DISCRIMINANT D4 — CONTRAINTE SAISIE : C5, début 19/06 ET date de
       contrainte 25/06 → MFO 25/06, 23 → 25/06. Ferme « la règle écrase une
       date de contrainte saisie ». */
    await ouvrir(page, C5);
    await page.locator('#taskStart').fill('2026-06-19');
    await page.locator('#taskConstraintDate').fill('2026-06-25');
    await enregistrer(page);
    expect((await lire(page, [C5])).etat[C5], 'C5 : la saisie fait foi').toBe('2026-06-23→2026-06-25 MFO 2026-06-25');

    // --- L'ASSERTION CENTRALE ---
    expect(c, 'C : relue 19 → 23, « Doit finir le 23/06 »').toBe('2026-06-19→2026-06-23 MFO 2026-06-23');
    await ouvrir(page, M);
    await page.locator('#taskStart').fill('2026-06-19');
    await enregistrer(page);
    expect((await lire(page, [M])).etat[M], 'M : relue 19 → 23, « Doit commencer le 19/06 »').toBe('2026-06-19→2026-06-23 MSO 2026-06-19');

    await deleteActiveProject(page);
});

test('fin tapée seule : seule une contrainte de fin suit', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Fin', [
        ['jeu-c3', 'C3 Façade', '2026-06-15', '2026-06-17', { constraintType: 'MFO', constraintDate: '2026-06-17' }],
        ['jeu-m2', 'M2 Toiture', '2026-06-15', '2026-06-17', { constraintType: 'MSO', constraintDate: '2026-06-15' }],
    ]);
    const [, C3, M2] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-dates-tapees-2.json');

    /* DISCRIMINANT — M2 (MSO 15/06), fin tapée 19/06 → 15 → 19/06, MSO
       15/06. Ferme « une contrainte de début suit quand on tape la fin ». */
    await ouvrir(page, M2);
    await page.locator('#taskEnd').fill('2026-06-19');
    await enregistrer(page);
    expect((await lire(page, [M2])).etat[M2], 'M2 : la contrainte de début reste').toBe('2026-06-15→2026-06-19 MSO 2026-06-15');

    // --- L'ASSERTION CENTRALE ---
    await ouvrir(page, C3);
    await page.locator('#taskEnd').fill('2026-06-19');
    await enregistrer(page);
    expect((await lire(page, [C3])).etat[C3], 'C3 : 15 → 19, « Doit finir le 19/06 »').toBe('2026-06-15→2026-06-19 MFO 2026-06-19');

    await deleteActiveProject(page);
});

test('le lien que la date tapée romprait est annoncé avant d\'enregistrer', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s, 'Conflit', [
        ['jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05'],
        ['jeu-b', 'B Fondations', '2026-06-15', '2026-06-17', { ...fs('jeu-a'), constraintType: 'MSO', constraintDate: '2026-06-15' }],
        ['jeu-s', 'S Réseaux', '2026-06-08', '2026-06-10', { ...fs('jeu-a'), constraintType: 'SNLT', constraintDate: '2026-06-12' }],
    ]);
    const [, A, B, S] = donnees.tasks.map(t => t.name);
    await monter(page, donnees, 'contraintes-dates-tapees-3.json');
    const apercu = page.locator('#taskConstraintInfo');

    /* DISCRIMINANT — UNE SOUPLE NE SUIT PAS AU PRIX D'UN LIEN : S (SNLT
       12/06), début tapé 03/06 → l'aperçu n'annonce aucun lien rompu ;
       enregistrée, S revient à 08 → 10/06, SNLT 12/06. */
    await ouvrir(page, S);
    await page.locator('#taskStart').fill('2026-06-03');
    await expect(apercu, 'S : aucun lien rompu annoncé').not.toContainText('Lien rompu');
    await enregistrer(page);
    expect((await lire(page, [S])).etat[S], 'S : la souple ne suit pas').toBe('2026-06-08→2026-06-10 SNLT 2026-06-12');

    // --- L'ASSERTION CENTRALE ---
    await ouvrir(page, B);
    await page.locator('#taskStart').fill('2026-06-05');
    await expect(apercu, 'l\'aperçu de B dit le lien rompu').toContainText(
        `Lien rompu avec « ${A} » : il exige le lundi 08/06/2026, la contrainte tiendrait le vendredi 05/06/2026, 1 jour ouvré plus tôt.`);
    await enregistrer(page);
    expect((await lire(page, [B])).etat[B], 'B : 05 → 09, « Doit commencer le 05/06 »').toBe('2026-06-05→2026-06-09 MSO 2026-06-05');
    await expect(page.locator('#toastContainer .toast-warning', { hasText: B }), 'le toast nomme B').toBeVisible();

    await deleteActiveProject(page);
});
