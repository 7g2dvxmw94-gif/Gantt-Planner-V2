import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G2 et G4 (exports), sous l'angle de l'ARBRE : les
 * exports suivent l'ordre et l'arborescence du Gantt.
 *
 * LE DÉFAUT. Le Gantt dessine l'arbre de getTaskTree() (store.js) : les
 * racines triées par le plus petit ordre de leur sous-arbre, et chaque
 * nœud suivi de TOUS ses descendants. Les exports CSV, XML et PDF (tableau
 * et frise) ont chacun leur propre parcours, recopié quatre fois : racines
 * triées par leur ordre propre, puis les seuls ENFANTS DIRECTS des seules
 * PHASES. Une phase placée après son premier enfant change de place ; une
 * sous-phase perd ses enfants ; une tâche ordinaire qui a des enfants les
 * perd tous. C'est la forme « deux implémentations d'une même règle qui
 * divergent ». Le WBS numérotera selon l'arbre : un export qui ne le suit
 * pas donnerait des codes dans le désordre.
 *
 * LE JEU, importé en JSON (ordre entre parenthèses) :
 *   T1(0) ; C(1), enfant de la phase P ; T2(2) ; P(3), phase ;
 *   P1(4), phase ⊃ P2(5), phase ⊃ X(6) ; ORD(7), tâche ordinaire ⊃ SOUS(8).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 3 failed (XML, CSV, PDF), chacun
 * sur son assertion centrale, l'export lisant « T1, T2, P, C, P1, P2,
 * ORD ». Le discriminant (ordre du Gantt) passe avant comme après. */

const CLES = ['T1', 'C', 'T2', 'P', 'P1', 'P2', 'X', 'ORD', 'SOUS'];
const ORDRE_GANTT = ['T1', 'P', 'C', 'T2', 'P1', 'P2', 'X', 'ORD', 'SOUS'];

function jeu(suffixe) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ExportArborescence ${suffixe}`, description: '' },
        tasks: [
            t('T1', 0), t('C', 1, { parentId: 'jeu-P' }), t('T2', 2), t('P', 3, { isPhase: true }),
            t('P1', 4, { isPhase: true }), t('P2', 5, { isPhase: true, parentId: 'jeu-P1' }), t('X', 6, { parentId: 'jeu-P2' }),
            t('ORD', 7), t('SOUS', 8, { parentId: 'jeu-ORD' }),
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

test('l\'export MS Project suit l\'arbre du Gantt', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    const xml = await fs.readFile(await exporter(page, 'XML'), 'utf-8');
    /* Les <Task>, sauf la récapitulative du projet (UID 0). */
    const noms = [...xml.matchAll(/<Task><UID>(\d+)<\/UID>[\s\S]*?<Name>([\s\S]*?)<\/Name>/g)]
        .filter(m => m[1] !== '0').map(m => m[2]);
    // --- L'ASSERTION CENTRALE ---
    expect(cles(noms, s), 'l\'ordre des <Task> du XML').toEqual(ORDRE_GANTT);
    /* Récapitulative : tout nœud qui a des enfants, phase ou non (ORD est
       une tâche ordinaire ⊃ SOUS ; P2, une sous-phase ⊃ X). */
    const bloc = (cle) => (xml.match(new RegExp(`<Task>(?:(?!</Task>)[\\s\\S])*<Name>${cle} ${s}</Name>[\\s\\S]*?</Task>`)) || [''])[0];
    expect({ ORD: bloc('ORD').includes('<Summary>1</Summary>'), P2: bloc('P2').includes('<Summary>1</Summary>'),
             T1: bloc('T1').includes('<Summary>1</Summary>') }, 'les récapitulatives').toEqual({ ORD: true, P2: true, T1: false });
    await deleteActiveProject(page);
});

test('l\'export CSV suit l\'arbre du Gantt', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    const csv = await fs.readFile(await exporter(page, 'CSV'), 'latin1');
    const noms = csv.split('\n').slice(1).map(l => l.split(';')[1]);
    // --- L'ASSERTION CENTRALE ---
    expect(cles(noms, s), 'l\'ordre des lignes du CSV').toEqual(ORDRE_GANTT);
    await (await present(page.locator('#msHelpOk'), 'aide d\'import MS Project')).click();
    await deleteActiveProject(page);
});

test('l\'export PDF (tableau et frise) suit l\'arbre du Gantt', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    await (await present(page.locator('#exportBtn'), 'bouton « Exporter »')).click();
    await page.locator('.export-dropdown-item').filter({ has: page.locator('.export-dropdown-label', { hasText: /^PDF$/ }) }).click();
    const dialogue = page.locator('#pdfExportDialog');
    await expect(dialogue).toBeVisible({ timeout: 10_000 });
    for (const v of ['table', 'timeline']) {
        const cb = dialogue.locator(`input[value="${v}"]`);
        if (await cb.count()) await cb.check();
    }
    const fenetrePromise = page.waitForEvent('popup');
    await dialogue.locator('.pdf-export-confirm').click();
    const fenetre = await fenetrePromise;
    await expect(fenetre.locator('body')).toContainText(`T1 ${s}`, { timeout: 15_000 });

    /* Le tableau des tâches est le premier du document (d'autres sections,
       comme les ressources, ont le leur). */
    const tableau = await fenetre.locator('table').first().locator('tbody tr td:first-child').allTextContents();
    const frise = await fenetre.locator('.gantt-tl-row .gantt-tl-label').allTextContents();
    await fenetre.close();
    // --- L'ASSERTION CENTRALE ---
    expect({ tableau: cles(tableau, s), frise: cles(frise, s) }, 'l\'ordre du tableau et de la frise du PDF')
        .toEqual({ tableau: ORDRE_GANTT, frise: ORDRE_GANTT });
    await deleteActiveProject(page);
});
