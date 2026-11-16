import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G2 (export CSV), sous l'angle des CONTRAINTES DE
 * DATE : l'export CSV écrit la contrainte de chaque tâche.
 *
 * LE BESOIN. Le CSV est l'export « tableur » de l'application, et celui
 * que l'aide propose d'ouvrir dans MS Project. Une contrainte de date n'y
 * figure pas : exporter puis rouvrir le planning la perd sans un mot.
 *
 * LE JEU, importé par le bouton « Importer » :
 *   T1  08 → 10/06/2026, « Doit finir le » 12/06 (MFO) ;
 *   T2  08 → 10/06/2026, sans contrainte.
 *
 * L'ATTENDU. Deux colonnes après les sept actuelles, « Type de
 * contrainte » et « Date de contrainte » : « Doit finir le » et
 * « 12/06/2026 » pour T1, « Dès que possible » et une case vide pour T2.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, l'en-tête à 7 colonnes. Les discriminants passent. */

function jeu(suffixe) {
    const tache = (id, name, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: 0, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ExportCsvContraintes ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-t1', 'T1 Fondations', { constraintType: 'MFO', constraintDate: '2026-06-12' }),
            { ...tache('jeu-t2', 'T2 Réseaux'), order: 1 },
        ],
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** Dates et identifiants des tâches nommées, lus dans le store VIVANT,
 *  filtrés par nom (le compte est partagé). */
async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const une = (n) => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0] : null; };
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: Object.fromEntries(noms.map(n => [n, une(n) ? `${une(n).startDate}→${une(n).endDate}` : 'introuvable'])),
            ids: Object.fromEntries(noms.map(n => [n, une(n)?.id ?? null])),
        };
    }, noms);
}

test('l\'export CSV écrit le type et la date de contrainte de chaque tâche', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [T1, T2] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'export-csv-contraintes.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE JEU EST LÀ, AVEC SA CONTRAINTE. Ferme « T1 n'a pas
       de contrainte à exporter ». */
    const contrainte = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const t = store.getTasks().find(x => x.name === nom);
        return t ? `${t.constraintType} ${t.constraintDate}` : null;
    }, T1);
    expect(contrainte, 'T1 porte sa contrainte').toBe('MFO 2026-06-12');

    await (await present(page.locator('#exportBtn'), 'bouton « Exporter »')).click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^CSV$/ }) })
        .click();
    const fichier = await (await telechargement).path();
    // Un octet par caractère (Windows-1252) : lu en latin1.
    const contenu = await fs.readFile(fichier, 'latin1');
    const [entete, ...lignes] = contenu.split('\n');
    const colonnes = entete.split(';');
    const ligneDe = (nom) => (lignes.find(l => l.includes(nom)) || '').split(';');

    /* Les colonnes sont lues à partir de « Niveau hiérarchique », non de
       la première : une colonne ajoutée devant (le code WBS) ne déplace
       pas la lecture. */
    const o = colonnes.indexOf('Niveau hiérarchique');
    expect(o, 'colonne « Niveau hiérarchique »').toBeGreaterThanOrEqual(0);

    /* DISCRIMINANT — LES SEPT COLONNES ACTUELLES, inchangées, dans
       l'ordre, et les dates de T1 à leur place. Ferme « les exports
       actuels changent » et « on lit une autre ligne ». */
    expect(colonnes.slice(o, o + 7), 'les sept colonnes actuelles').toEqual(
        ['Niveau hiérarchique', 'Nom', 'Durée', 'Début', 'Fin', 'Noms ressources', '% achevé']);
    expect(ligneDe(T1).slice(o + 1, o + 5), 'la ligne de T1').toEqual([T1, '3 jours', '08/06/2026', '10/06/2026']);

    // --- L'ASSERTION CENTRALE ---
    expect(colonnes.slice(o), 'deux colonnes de contrainte après les sept actuelles').toEqual(
        ['Niveau hiérarchique', 'Nom', 'Durée', 'Début', 'Fin', 'Noms ressources', '% achevé',
         'Type de contrainte', 'Date de contrainte']);
    expect(ligneDe(T1).slice(o + 7), 'T1 : « Doit finir le » 12/06/2026').toEqual(['Doit finir le', '12/06/2026']);
    expect(ligneDe(T2).slice(o + 7), 'T2 : « Dès que possible », sans date').toEqual(['Dès que possible', '']);

    await (await present(page.locator('#msHelpOk'), 'aide d\'import MS Project')).click();
    await expect(page.locator('#msHelpOk')).toBeHidden();
    await deleteActiveProject(page);
});
