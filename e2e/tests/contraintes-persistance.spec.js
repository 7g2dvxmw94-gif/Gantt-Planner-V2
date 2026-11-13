import { test, expect } from '../fixtures.js';
import { readFileSync } from 'fs';
import { deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G1 (export et réimport JSON), sous l'angle des
 * CONTRAINTES DE DATE : une tâche peut porter une contrainte, à la manière
 * de MS Project (« Doit finir le », « Début au plus tôt le »…), et doit la
 * garder en base.
 *
 * LE BESOIN. C'est la première marche des contraintes de date : avant que
 * le moteur les applique, que la fiche les pose ou que l'export MS Project
 * les écrive, le modèle doit les garder. (L'export JSON, lui, recopie déjà
 * la tâche telle qu'elle est en mémoire : c'est par lui que ce test lit la
 * contrainte.) Aujourd'hui, une contrainte portée par un fichier
 * JSON vit en mémoire jusqu'au rechargement, puis disparaît sans message :
 * store.importProject() recopie la tâche telle quelle (`...t`), mais
 * taskToRow() (supabase-store.js) n'écrit que les champs qu'il nomme, et
 * rowToTask() ne relit que les siens. Aucune colonne ne reçoit la
 * contrainte.
 *
 * MESURÉ sur origin/main 2acfc17, application entière avec un faux
 * Supabase à mémoire dont la table tasks n'accepte que les colonnes des
 * migrations du commit : chaque ligne envoyée compte 29 colonnes, aucune de
 * contrainte ; après rechargement, l'export relit B « undefined /
 * undefined ».
 *
 * LE JEU, importé par le bouton « Importer » sous la forme d'un export :
 *   A  01→05/06/2026, sans contrainte ;
 *   B  10→12/06, précédée par A (FS), « Doit finir le » 12/06/2026 (MFO) :
 *      la seule contrainte lisible du jeu, tenue par ses propres dates ;
 *   C  08→09/06, type inconnu 'XYZ' (date lisible) ;
 *   D  15→17/06, MSO au 30 février, date qui n'existe pas ;
 *   E  22→24/06, SNET au '12/06/2026', date écrite à la française.
 * C, D et E doivent arriver en base SANS contrainte, et surtout arriver.
 * Mesuré sur un Postgres 16 local, la table tasks de 001 et 015 plus la
 * migration 029 : 'XYZ' heurte la contrainte CHECK (23514), '2026-02-30'
 * est hors limites (22008), et chaque refus rejette TOUTE la ligne, dates
 * comprises. '12/06/2026' passe, mais se relit 2026-12-06 sous le DateStyle
 * d'initdb (« ISO, MDY »). Aucune ne peut donc partir telle quelle.
 *
 * CE TEST N'ÉCRIT AUCUNE COLONNE LUI-MÊME. Il passe par l'import, donc par
 * taskToRow : poussé avant la migration 029, il ne peut pas faire échouer
 * une écriture, et son rouge porte sur la relecture.
 *
 * ROUGE ATTENDU : 1 failed, sur l'assertion centrale, « contrainte de B
 * relue après rechargement : undefined / undefined ». */

/** Le fichier importé : la forme d'un export (projet, tâches, ressources). */
function jeu(suffixe) {
    const nom = (lettre, libelle) => `${lettre} ${libelle} ${suffixe}`;
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E Contraintes ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', nom('A', 'Terrassement'), '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', nom('B', 'Fondations'), '2026-06-10', '2026-06-12', 1, {
                dependencies: [{ taskId: 'jeu-a', type: 'FS', lag: 0 }],
                constraintType: 'MFO', constraintDate: '2026-06-12',
            }),
            tache('jeu-c', nom('C', 'Réseaux'), '2026-06-08', '2026-06-09', 2, {
                constraintType: 'XYZ', constraintDate: '2026-06-08',
            }),
            tache('jeu-d', nom('D', 'Élévation'), '2026-06-15', '2026-06-17', 3, {
                constraintType: 'MSO', constraintDate: '2026-02-30',
            }),
            tache('jeu-e', nom('E', 'Charpente'), '2026-06-22', '2026-06-24', 4, {
                constraintType: 'SNET', constraintDate: '12/06/2026',
            }),
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

test('une tâche garde sa contrainte de date en base, et une contrainte illisible est écartée sans perdre la tâche', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, C, D, E] = donnees.tasks;

    /* Toute erreur de console de la page, dès avant l'import : c'est là
       que importProject() signale une ligne refusée par la base. */
    const erreurs = [];
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });

    await page.goto('index.html');
    await waitForAppReady(page);

    /* Présence avant l'action : si le bouton manquait, l'échec le dirait
       en clair, au lieu d'un clic qui expire sans motif. */
    await expect(page.locator('#importBtn'), 'le bouton « Importer » doit être là').toBeVisible({ timeout: 10_000 });
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    /* Nom de fichier explicite avec l'extension : _importProject() trie par
       extension (leçon de import-json.spec.js). */
    await (await selecteur).setFiles({
        name: 'contraintes.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    /* Le projet importé devient actif AVANT les écritures en base : il est
       confié au filet de nettoyage dès ce moment. */
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    const idCopie = await trackActiveProject(page);

    /* Le toast part après la fin des écritures : importProject() attend
       chaque upsertTask avant de rendre la main. */
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT 1 — L'IMPORT A PRIS LA CONTRAINTE DE B.
       Avant tout rechargement, l'export porte la contrainte du fichier.
       Ferme « l'import JSON ne lit pas le champ » : une contrainte absente
       après rechargement ne dirait alors rien de la base. Passe avant
       comme après. */
    const avant = await exporterJSON(page);
    const [bAvant] = parNom(avant, B.name);
    expect({ constraintType: bAvant?.constraintType, constraintDate: bAvant?.constraintDate },
        'avant rechargement, l\'export porte la contrainte de B')
        .toEqual({ constraintType: 'MFO', constraintDate: '2026-06-12' });

    /* DISCRIMINANT 2 — LA BASE N'A REFUSÉ AUCUNE LIGNE.
       importProject() journalise « [importProject] upsertTask failed » pour
       chaque tâche que PostgREST refuse. Ferme « la tâche a été rejetée en
       entier » : faute de colonne (migration absente), parce qu'une date
       comme '2026-02-30' serait partie telle quelle, ou parce qu'un type
       inconnu aurait heurté la contrainte CHECK. Le message montre l'erreur
       de la base. Passe avant comme après. */
    expect(erreurs.filter(e => /upsertTask/.test(e)), 'aucune écriture de tâche refusée par la base')
        .toEqual([]);

    /* Le rechargement fait relire la base : la contrainte doit être en
       base, pas seulement en mémoire. */
    await page.reload();
    await waitForAppReady(page);

    /* DISCRIMINANT 3 — LE PROJET ROUVERT EST LA COPIE IMPORTÉE.
       Ferme « on relit un autre projet du compte partagé », dont les tâches
       ne porteraient rien. Passe avant comme après. */
    const idActif = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.id ?? null;
    });
    expect(idActif, 'après rechargement, le projet actif doit être la copie importée').toBe(idCopie);
    await expectProjectName(page, nomProjet);

    const apres = await exporterJSON(page);

    /* DISCRIMINANT 4 — CHAQUE TÂCHE A SURVÉCU, UNE FOIS, AVEC SES DATES.
       Ferme « toute la tâche est perdue » (ligne rejetée, ou base non
       relue) et « la tâche a été recalée » : l'échec central ne pourra
       porter que sur la contrainte. Filtré par nom : le compte est
       partagé. Passe avant comme après. */
    for (const t of [A, B, C, D, E]) {
        const relues = parNom(apres, t.name);
        expect(relues.map(r => `${r.startDate} → ${r.endDate}`),
            `après rechargement, ${t.name.split(' ')[0]} est là, une fois, à ses dates`)
            .toEqual([`${t.startDate} → ${t.endDate}`]);
    }

    /* --- L'ASSERTION CENTRALE ---
       B garde sa contrainte après rechargement. Tant qu'aucune colonne ne
       la reçoit, le message dira « undefined / undefined ». */
    const [b] = parNom(apres, B.name);
    expect({ constraintType: b.constraintType, constraintDate: b.constraintDate },
        `contrainte de B relue après rechargement : ${b.constraintType} / ${b.constraintDate}`)
        .toEqual({ constraintType: 'MFO', constraintDate: '2026-06-12' });

    /* Et les contraintes illisibles ont été écartées, type ET date : C, D
       et E se relisent « Dès que possible », c'est-à-dire null. */
    for (const t of [C, D, E]) {
        const [r] = parNom(apres, t.name);
        expect({ constraintType: r.constraintType, constraintDate: r.constraintDate },
            `contrainte de ${t.name.split(' ')[0]} relue après rechargement (fichier : ${t.constraintType} / ${t.constraintDate})`)
            .toEqual({ constraintType: null, constraintDate: null });
    }

    await deleteActiveProject(page);
});
