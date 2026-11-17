import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G4 (import MS Project), sous l'angle des DATES
 * RÉELLES : l'import XML lit <ActualStart> et <ActualFinish>.
 *
 * LE BESOIN. Un planning MS Project en cours porte ses dates réelles. Sans
 * elles, l'import fait de chaque tâche commencée une tâche non commencée,
 * que le moteur replace ensuite au gré de ses liens.
 *
 * LA RÈGLE : chaque date réelle est lue (sa partie date), puis passe par la
 * règle unique datesReellesDe, comme à l'import JSON et à l'écriture en
 * base : une Fin réelle seule prend pour début le début prévu ; une date
 * illisible est écartée sans perdre la tâche.
 *
 * LE JEU, un fichier MSPDI écrit ici, sans récapitulative :
 *   A  08 → 10/06/2026, réel 08 → 10, 100 % ;
 *   B  11 → 15/06, commencée le 11, 40 % ;
 *   C  01 → 03/06, aucun réel ;
 *   D  16 → 17/06, <ActualFinish> 17 SEUL → début réel 16 ;
 *   F  22 → 24/06, <ActualStart> illisible (« NA ») → écarté.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : toutes les tâches relues « —→— ». Les discriminants passent. */

const TACHES = [
    ['A', '2026-06-08', '2026-06-10', 100, '2026-06-08T08:00:00', '2026-06-10T17:00:00'],
    ['B', '2026-06-11', '2026-06-15', 40, '2026-06-11T08:00:00', null],
    ['C', '2026-06-01', '2026-06-03', 0, null, null],
    ['D', '2026-06-16', '2026-06-17', 100, null, '2026-06-17T17:00:00'],
    ['F', '2026-06-22', '2026-06-24', 10, 'NA', null],
];

function xml(nomProjet, s) {
    const lignes = TACHES.map(([cle, debut, fin, pct, ds, df], i) => {
        const uid = i + 1;
        return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${cle} Import ${s}</Name><OutlineLevel>1</OutlineLevel>` +
            `<Start>${debut}T08:00:00</Start><Finish>${fin}T17:00:00</Finish>` +
            `<Duration>PT24H0M0S</Duration><PercentComplete>${pct}</PercentComplete>` +
            (ds ? `<ActualStart>${ds}</ActualStart>` : '') + (df ? `<ActualFinish>${df}</ActualFinish>` : '') +
            `</Task>`;
    }).join('\n      ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
   <Name>${nomProjet}</Name>
   <Tasks>
      <Task><UID>0</UID><ID>0</ID><Name>${nomProjet}</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>
      ${lignes}
   </Tasks>
</Project>`;
}

/** « clé:début→fin avancement% réel début→fin » lu dans le store VIVANT. */
async function lire(page, s) {
    return page.evaluate(async (s) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return {
            projet: store.getActiveProject()?.name ?? null,
            taches: ['A', 'B', 'C', 'D', 'F'].map(c => {
                const x = store.getTasks().filter(t => t.name === `${c} Import ${s}`);
                if (x.length !== 1) return `${c}:${x.length} tâche(s)`;
                return `${c}:${x[0].startDate}→${x[0].endDate} ${x[0].progress}% réel ${x[0].actualStart ?? '—'}→${x[0].actualFinish ?? '—'}`;
            }),
        };
    }, String(s));
}

test('l\'import MS Project lit le Début réel et la Fin réelle', async ({ page }) => {
    const s = Date.now();
    const nomProjet = `E2E DatesReellesImportXml ${s}`;
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'dates-reelles-import.xml', mimeType: 'application/xml', buffer: Buffer.from(xml(nomProjet, s)) });
    await expect.poll(async () => (await lire(page, s)).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    /* DISCRIMINANT — L'IMPORT EST ALLÉ À SON TERME. Le projet devient actif
       AVANT que ses tâches soient écrites en base (store.js,
       importFromMSProjectXML : activeProjectId, puis _persisterImport) ; le
       toast ne paraît qu'après l'écriture. Ferme « le rechargement plus bas
       relit une base où les tâches ne sont pas encore » : sans cette
       attente, le témoin relisait 0 tâche (run 44150845771). */
    await expect(page.locator('#toastContainer .toast', { hasText: nomProjet }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    const attendu = [
        'A:2026-06-08→2026-06-10 100% réel 2026-06-08→2026-06-10',
        'B:2026-06-11→2026-06-15 40% réel 2026-06-11→—',
        'C:2026-06-01→2026-06-03 0% réel —→—',
        'D:2026-06-16→2026-06-17 100% réel 2026-06-16→2026-06-17',
        'F:2026-06-22→2026-06-24 10% réel —→—',
    ];
    /* DISCRIMINANT — LES CINQ TÂCHES SONT LÀ, À LEURS DATES ET LEUR
       AVANCEMENT. Ferme « l'import a échoué, ou F, à la date illisible, a
       été perdue ». Passe avant comme après. */
    const lu = await lire(page, s);
    expect(lu.taches.map(x => x.replace(/ réel .*$/, '')), 'les tâches importées').toEqual(attendu.map(x => x.replace(/ réel .*$/, '')));

    // --- L'ASSERTION CENTRALE ---
    expect(lu.taches, 'les dates réelles lues dans le fichier').toEqual(attendu);

    /* TÉMOIN — relues de la base après rechargement. */
    await page.reload();
    await waitForAppReady(page);
    await expect.poll(async () => (await lire(page, s)).taches,
        { message: 'après rechargement', timeout: 15_000 }).toEqual(attendu);

    await deleteActiveProject(page);
});
