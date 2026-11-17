import { test, expect } from '../fixtures.js';
import { readFileSync } from 'fs';
import { deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G1 (export et réimport JSON), sous l'angle des
 * DATES RÉELLES : une tâche peut porter un Début réel et une Fin réelle, à
 * la manière de MS Project, et doit les garder en base.
 *
 * LE BESOIN. Première marche des dates réelles (plan, R0) : avant que la
 * fiche les saisisse ou que le moteur s'y ancre, le modèle doit les
 * garder. L'import JSON recopie la tâche telle quelle (`...t`), mais
 * taskToRow() n'écrit que les champs qu'il nomme et rowToTask() ne relit
 * que les siens : au rechargement, les dates réelles disparaissent.
 *
 * LES RÈGLES (normalisation du client, doublée par les CHECK de la
 * migration 030) : une date réelle illisible est écartée ; une Fin réelle
 * sans Début réel prend pour début le début prévu (règle MS Project) ; une
 * Fin réelle antérieure au Début réel est écartée. Aucune ne doit faire
 * perdre la tâche.
 *
 * LE JEU, importé sous la forme d'un export :
 *   A  01→05/06/2026, réel 01/06 → 05/06 (finie) ;
 *   B  08→12/06, réel commencé le 08/06 (en cours) ;
 *   C  15→17/06, Fin réelle 17/06 seule → début réel 15/06 (le prévu) ;
 *   D  22→24/06, réel 24/06 → 22/06 (fin avant début) → fin écartée ;
 *   E  29/06→01/07, Début réel au 30 février → écarté.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : les dates réelles relues après rechargement valent
 * « undefined ». Les discriminants passent. */

function jeu(suffixe) {
    const nom = (lettre) => `${lettre} Réel ${suffixe}`;
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E DatesReelles ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', nom('A'), '2026-06-01', '2026-06-05', 0, { actualStart: '2026-06-01', actualFinish: '2026-06-05', progress: 100, status: 'done' }),
            tache('jeu-b', nom('B'), '2026-06-08', '2026-06-12', 1, { actualStart: '2026-06-08', progress: 40, status: 'in_progress' }),
            tache('jeu-c', nom('C'), '2026-06-15', '2026-06-17', 2, { actualFinish: '2026-06-17' }),
            tache('jeu-d', nom('D'), '2026-06-22', '2026-06-24', 3, { actualStart: '2026-06-24', actualFinish: '2026-06-22' }),
            tache('jeu-e', nom('E'), '2026-06-29', '2026-07-01', 4, { actualStart: '2026-02-30' }),
        ],
        resources: [],
    };
}

/** Exporte le projet actif en JSON par le menu « Exporter » et relit le
 *  fichier téléchargé. */
async function exporterJSON(page) {
    await expect(page.locator('#exportBtn'), 'le bouton « Exporter » doit être là').toBeVisible({ timeout: 10_000 });
    await page.locator('#exportBtn').click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^JSON$/ }) })
        .click();
    return JSON.parse(readFileSync(await (await telechargement).path(), 'utf-8'));
}

const parNom = (exporte, nom) => exporte.tasks.filter(t => t.name === nom);

test('une tâche garde ses dates réelles en base, et une date réelle incohérente est corrigée sans perdre la tâche', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const taches = donnees.tasks;
    const [A, B] = taches;

    const erreurs = [];
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });

    await page.goto('index.html');
    await waitForAppReady(page);
    await expect(page.locator('#importBtn'), 'le bouton « Importer » doit être là').toBeVisible({ timeout: 10_000 });
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({
        name: 'dates-reelles.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)),
    });
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    const idCopie = await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT 1 — L'IMPORT A PRIS LES DATES RÉELLES de A et B, avant
       tout rechargement. Ferme « l'import JSON ne lit pas le champ ». */
    const avant = await exporterJSON(page);
    const [aAvant] = parNom(avant, A.name);
    const [bAvant] = parNom(avant, B.name);
    expect([aAvant?.actualStart, aAvant?.actualFinish, bAvant?.actualStart],
        'avant rechargement, l\'export porte les dates réelles de A et B')
        .toEqual(['2026-06-01', '2026-06-05', '2026-06-08']);

    /* DISCRIMINANT 2 — LA BASE N'A REFUSÉ AUCUNE LIGNE (migration absente,
       ou date illisible partie telle quelle). */
    expect(erreurs.filter(e => /upsertTask/.test(e)), 'aucune écriture de tâche refusée par la base').toEqual([]);

    await page.reload();
    await waitForAppReady(page);

    /* DISCRIMINANT 3 — LE PROJET ROUVERT EST LA COPIE IMPORTÉE. */
    const idActif = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.id ?? null;
    });
    expect(idActif, 'après rechargement, le projet actif doit être la copie importée').toBe(idCopie);
    await expectProjectName(page, nomProjet);

    const apres = await exporterJSON(page);

    /* DISCRIMINANT 4 — CHAQUE TÂCHE A SURVÉCU, UNE FOIS, À SES DATES
       PRÉVUES. Ferme « la tâche est perdue » et « elle a été recalée ». */
    for (const t of taches) {
        expect(parNom(apres, t.name).map(r => `${r.startDate} → ${r.endDate}`),
            `après rechargement, ${t.name.split(' ')[0]} est là, une fois, à ses dates`)
            .toEqual([`${t.startDate} → ${t.endDate}`]);
    }

    // --- L'ASSERTION CENTRALE ---
    const lu = Object.fromEntries(taches.map(t => {
        const [r] = parNom(apres, t.name);
        return [t.name.split(' ')[0], `${r.actualStart} → ${r.actualFinish}`];
    }));
    expect(lu, 'dates réelles relues après rechargement').toEqual({
        A: '2026-06-01 → 2026-06-05',
        B: '2026-06-08 → null',
        C: '2026-06-15 → 2026-06-17',
        D: '2026-06-24 → null',
        E: 'null → null',
    });

    await deleteActiveProject(page);
});
