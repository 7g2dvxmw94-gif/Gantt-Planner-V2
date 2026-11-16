import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* WBS, fonctionnalité F4 : l'export MS Project (XML) porte le code WBS de
 * chaque tâche, en <WBS> et en <OutlineNumber> (le numéro hiérarchique de
 * MS Project), entre <Name> et <OutlineLevel> comme le veut le schéma
 * MSPDI. Le code est celui de F1 (store.getWbs), calculé sur l'arbre du
 * Gantt que l'export suit déjà (#137).
 *
 * LE JEU : celui de export-arborescence.spec.js, plus le jalon JAL (ordre
 * 9) sous la sous-phase P2. Codes attendus : T1 1, P 2, C 2.1, T2 3, P1 4,
 * P2 4.1, X 4.1.1, JAL 4.1.2, ORD 5, SOUS 5.1.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : aucun <WBS> dans les blocs. Les discriminants passent. */

const ORDRE_GANTT = ['T1', 'P', 'C', 'T2', 'P1', 'P2', 'X', 'JAL', 'ORD', 'SOUS'];
const CODES = { T1: '1', P: '2', C: '2.1', T2: '3', P1: '4', P2: '4.1', X: '4.1.1', JAL: '4.1.2', ORD: '5', SOUS: '5.1' };

function jeu(suffixe) {
    const t = (cle, ordre, extra = {}) => ({
        id: `jeu-${cle}`, name: `${cle} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ExportXmlWbs ${suffixe}`, description: '' },
        tasks: [
            t('T1', 0), t('C', 1, { parentId: 'jeu-P' }), t('T2', 2), t('P', 3, { isPhase: true }),
            t('P1', 4, { isPhase: true }), t('P2', 5, { isPhase: true, parentId: 'jeu-P1' }), t('X', 6, { parentId: 'jeu-P2' }),
            t('ORD', 7), t('SOUS', 8, { parentId: 'jeu-ORD' }),
            t('JAL', 9, { parentId: 'jeu-P2', isMilestone: true, startDate: '2026-06-10', endDate: '2026-06-10' }),
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

test('l\'export MS Project porte le code WBS de chaque tâche', async ({ page }) => {
    const s = Date.now();
    await monter(page, s);
    const xml = await fs.readFile(await exporter(page, 'XML'), 'utf-8');
    const bloc = (cle) => (xml.match(new RegExp(`<Task>(?:(?!</Task>)[\\s\\S])*<Name>${cle} ${s}</Name>[\\s\\S]*?</Task>`)) || [''])[0];

    /* DISCRIMINANTS — le XML suit l'arbre du Gantt (#137), et X y est au
       niveau 3 : un code faux ne viendrait ni de l'ordre ni de la
       profondeur. */
    const noms = [...xml.matchAll(/<Task><UID>(\d+)<\/UID>[\s\S]*?<Name>([\s\S]*?)<\/Name>/g)]
        .filter(m => m[1] !== '0').map(m => m[2]);
    expect(cles(noms, s), 'l\'ordre des <Task> du XML').toEqual(ORDRE_GANTT);
    expect(bloc('X'), 'X au niveau 3').toContain('<OutlineLevel>3</OutlineLevel>');

    // --- L'ASSERTION CENTRALE ---
    const lus = Object.fromEntries(Object.keys(CODES).map(cle => {
        const b = bloc(cle);
        const wbs = (b.match(/<WBS>([^<]*)<\/WBS>/) || [])[1] ?? null;
        const num = (b.match(/<OutlineNumber>([^<]*)<\/OutlineNumber>/) || [])[1] ?? null;
        return [cle, `${wbs}|${num}`];
    }));
    expect(lus, '<WBS>|<OutlineNumber> de chaque tâche')
        .toEqual(Object.fromEntries(Object.entries(CODES).map(([k, c]) => [k, `${c}|${c}`])));
    /* L'ordre du schéma MSPDI : Name, WBS, OutlineNumber, OutlineLevel. */
    expect(bloc('X'), 'ordre des éléments de X').toMatch(/<\/Name><WBS>4\.1\.1<\/WBS><OutlineNumber>4\.1\.1<\/OutlineNumber><OutlineLevel>3<\/OutlineLevel>/);

    await deleteActiveProject(page);
});
