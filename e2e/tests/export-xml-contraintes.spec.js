import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G4 (export MS Project), sous l'angle des
 * CONTRAINTES DE DATE : l'export XML écrit la contrainte de chaque tâche.
 *
 * LE BESOIN. L'export « XML » est celui qu'on ouvre dans MS Project. Une
 * contrainte de date n'y figure pas : le planning arrive sans ses
 * « Doit finir le », et MS Project le replace autrement.
 *
 * LE FORMAT (schéma MSPDI, élément Task) : <ConstraintType> (0 = dès que
 * possible, 2 = doit commencer le, 3 = doit finir le, 4 = début au plus
 * tôt le, 5 = début au plus tard le, 6 = fin au plus tôt le, 7 = fin au
 * plus tard le) et <ConstraintDate>, aux rangs 64 et 66 de la séquence de
 * <Task> : après <PercentComplete> (rang 44), avant <PredecessorLink>
 * (rang 85). L'heure suit celle des dates de la tâche à l'export : 08:00
 * pour une contrainte de début, 17:00 pour une contrainte de fin.
 *
 * LE JEU, importé par le bouton « Importer » : A, sans contrainte, puis
 * six tâches liées à A en Fin→Début, une par type de contrainte.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « ConstraintType absent du bloc de la MFO ». Les
 * discriminants passent. */

/** Les six types, leur code MSPDI, leur date et leur heure attendue. */
const TYPES = [
    ['SNET', '4', '2026-06-08', '08:00:00'],
    ['SNLT', '5', '2026-06-09', '08:00:00'],
    ['FNET', '6', '2026-06-10', '17:00:00'],
    ['FNLT', '7', '2026-06-11', '17:00:00'],
    ['MSO',  '2', '2026-06-15', '08:00:00'],
    ['MFO',  '3', '2026-06-12', '17:00:00'],
];

function jeu(suffixe) {
    const tache = (id, name, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate: '2026-06-08', endDate: '2026-06-10',
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E ExportXmlContraintes ${suffixe}`, description: '' },
        tasks: [
            { ...tache('jeu-a', 'A Socle', 0), startDate: '2026-06-01', endDate: '2026-06-05' },
            ...TYPES.map(([type, , date], i) => tache(`jeu-${type}`, `${type} Tâche`, i + 1, {
                dependencies: [{ taskId: 'jeu-a', type: 'FS', lag: 0 }],
                constraintType: type, constraintDate: date,
            })),
        ],
        resources: [],
    };
}

/** Les blocs <Task>…</Task>, indexés par nom de tâche. */
function tachesParNom(xml) {
    const index = {};
    for (const bloc of xml.match(/<Task>[\s\S]*?<\/Task>/g) || []) {
        const nom = (bloc.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1];
        if (nom) index[nom] = bloc;
    }
    return index;
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

test('l\'export MS Project écrit le type et la date de contrainte, à leur rang', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const noms = donnees.tasks.map(t => t.name);
    const A = noms[0];

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'export-xml-contraintes.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LES CONTRAINTES SONT DANS LE STORE. Ferme « il n'y a
       rien à exporter ». */
    const portees = await page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return noms.map(n => { const t = store.getTasks().find(x => x.name === n); return t ? (t.constraintType || '—') : 'absente'; });
    }, noms);
    expect(portees, 'chaque tâche porte sa contrainte').toEqual(['—', ...TYPES.map(([type]) => type)]);

    await (await present(page.locator('#exportBtn'), 'bouton « Exporter »')).click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^XML$/ }) })
        .click();
    const xml = await fs.readFile(await (await telechargement).path(), 'utf-8');
    const blocs = tachesParNom(xml);

    /* DISCRIMINANT D1 — LE BLOC DE CHAQUE TÂCHE CONTRAINTE CONTIENT SON
       <PredecessorLink>. Ferme « on lit un autre bloc », et donne le repère
       du rang 85. */
    for (const nom of noms.slice(1)) {
        expect(blocs[nom] || '', `le bloc de « ${nom} » et son lien`).toContain('<PredecessorLink>');
    }
    /* DISCRIMINANT D2 — A, « dès que possible », n'a pas de ConstraintType.
       Ferme « les exports actuels changent ». */
    expect(blocs[A] || 'absent', 'A : pas de contrainte écrite').not.toContain('<ConstraintType>');

    // --- L'ASSERTION CENTRALE ---
    const mfo = blocs[noms[TYPES.findIndex(([t]) => t === 'MFO') + 1]];
    expect(mfo, 'ConstraintType absent du bloc de la MFO').toContain(
        '<ConstraintType>3</ConstraintType><ConstraintDate>2026-06-12T17:00:00</ConstraintDate>');
    TYPES.forEach(([type, code, date, heure], i) => {
        const bloc = blocs[noms[i + 1]];
        const attendu = `<ConstraintType>${code}</ConstraintType><ConstraintDate>${date}T${heure}</ConstraintDate>`;
        expect(bloc, `${type} : ${attendu}`).toContain(attendu);
        const rang = (balise) => bloc.indexOf(balise);
        expect(rang('<PercentComplete>') < rang('<ConstraintType>') && rang('<ConstraintType>') < rang('<PredecessorLink>'),
            `${type} : la contrainte entre <PercentComplete> et <PredecessorLink> (rangs 44 < 64 < 85)`).toBe(true);
    });

    await deleteActiveProject(page);
});
