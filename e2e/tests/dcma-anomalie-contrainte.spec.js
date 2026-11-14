import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § E2 (rapport DCMA) : le DCMA explique une marge
 * négative due à une contrainte de date.
 *
 * LE BESOIN. Depuis #116, la marge d'une tâche est bornée aussi par les
 * contraintes de date en aval. Une tâche peut donc avoir une marge
 * négative sans qu'aucun de ses liens soit incohérent : une « Doit finir
 * le » en aval la tient trop court. Le rapport DCMA la range pourtant
 * parmi les anomalies avec le seul message qu'il connaisse : « ses liens
 * et ses dates se contredisent ». C'est faux, et cela envoie chercher au
 * mauvais endroit.
 *
 * LE JEU, importé par le bouton « Importer », sans date d'état ni
 * échéance :
 *   A  01 → 05/06 ;
 *   B  Fin→Début de A, « Doit finir le » 09/06 (MFO), placée 05 → 09/06 :
 *      la contrainte l'emporte, B commence le 05 ; la marge de A, bornée
 *      par la contrainte de B, est négative. Les liens, eux, n'en donnent
 *      pas : rien ne suit B ;
 *   W  01 → 05/06 ;
 *   X  Fin→Début de W, SANS contrainte, importée 03 → 30/06 : le lien
 *      n'est pas tenu, et X finit le projet. La marge de W est négative
 *      par ses seuls liens.
 *
 * L'ATTENDU. L'anomalie de A dit qu'elle vient d'une contrainte de date en
 * aval ; celle de W garde le message des liens incohérents.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, le texte de l'anomalie de A. Les discriminants passent.
 * JUIN 2026 COMMENCE UN LUNDI. */

function jeu(suffixe) {
    const tache = (id, name, startDate, endDate, ordre, extra = {}) => ({
        id, name: `${name} ${suffixe}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1',
        order: ordre, parentId: null, isMilestone: false, isPhase: false, isPermit: false,
        assignees: [], dependencies: [], ...extra,
    });
    const fs = (taskId) => [{ taskId, type: 'FS', lag: 0 }];
    return {
        project: { id: 'jeu-projet', name: `E2E DcmaAnomalieContrainte ${suffixe}`, description: '' },
        tasks: [
            tache('jeu-a', 'A Terrassement', '2026-06-01', '2026-06-05', 0),
            tache('jeu-b', 'B Fondations', '2026-06-05', '2026-06-09', 1, {
                dependencies: fs('jeu-a'), constraintType: 'MFO', constraintDate: '2026-06-09',
            }),
            tache('jeu-w', 'W Réseaux', '2026-06-01', '2026-06-05', 2),
            tache('jeu-x', 'X Voirie', '2026-06-03', '2026-06-30', 3, { dependencies: fs('jeu-w') }),
        ],
        resources: [],
    };
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

const barreDe = (page, nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
const ligneDe = (page, nom) => page.locator('.gantt-row').filter({ has: barreDe(page, nom) });

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

test('le DCMA dit qu\'une marge négative vient d\'une contrainte de date, et garde le message des liens incohérents', async ({ page }) => {
    const suffixe = Date.now();
    const donnees = jeu(suffixe);
    const nomProjet = donnees.project.name;
    const [A, B, W, X] = donnees.tasks.map(t => t.name);

    await page.goto('index.html');
    await waitForAppReady(page);

    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'dcma-anomalie-contrainte.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });

    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${nomProjet}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE JEU EST À SES DATES. Ferme « B a suivi A » (pas de
       marge négative venue de la contrainte) et « X a été replacée » (pas
       de lien incohérent). */
    const lu = await lire(page, [A, B, W, X]);
    expect(lu.dates, 'le jeu importé n\'est pas à ses dates').toEqual({
        [A]: '2026-06-01→2026-06-05', [B]: '2026-06-05→2026-06-09',
        [W]: '2026-06-01→2026-06-05', [X]: '2026-06-03→2026-06-30',
    });

    await (await present(page.locator('#dcmaBtn'), 'bouton du rapport DCMA')).click();
    const rapport = page.locator('#dcmaReportModal [role="dialog"]');
    await expect(rapport, 'le rapport DCMA doit s\'ouvrir').toBeVisible();

    /* DISCRIMINANT D1 — SANS ÉCHÉANCE, le point 7 est « sans objet » : la
       marge négative est rangée parmi les anomalies, et nulle part
       ailleurs. Ferme « une échéance est posée » (le compte partagé ne la
       porte pas, mais le projet importé pourrait en hériter). */
    await expect(rapport.locator('tr[data-dcma-point="7"]'), 'point 7 sans objet sans échéance')
        .toHaveAttribute('data-etat', 'na');

    /* DISCRIMINANT D2 — L'ANOMALIE DE W, aux liens incohérents, est là et
       garde son message. Ferme « tous les messages ont changé », et « A
       n'est simplement pas listée ». */
    const anomalies = rapport.locator('li[data-dcma-anomalie]');
    const deW = anomalies.filter({ hasText: `« ${W} »` });
    await expect(deW, 'une anomalie, et une seule, pour W').toHaveCount(1);
    await expect(deW, 'W : le message des liens incohérents').toContainText('ses liens et ses dates se contredisent');
    const deA = anomalies.filter({ hasText: `« ${A} »` });
    await expect(deA, 'une anomalie, et une seule, pour A').toHaveCount(1);

    // --- L'ASSERTION CENTRALE ---
    await expect(deA, 'A : sa marge négative vient d\'une contrainte de date en aval')
        .toContainText('une contrainte de date en aval');
    await expect(deA, 'A : ses liens ne contredisent pas ses dates').not.toContainText('ses liens et ses dates se contredisent');

    await page.keyboard.press('Escape');
    await expect(page.locator('#dcmaReportModal')).toHaveCount(0);
    await deleteActiveProject(page);
});
