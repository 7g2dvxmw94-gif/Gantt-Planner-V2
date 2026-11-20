import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* TEST_PLAN.md § A7, étape 3 : « Mettre à jour le projet », comme dans MS
 * Project — l'avancement est porté jusqu'à la date d'état en un geste.
 *
 * LES RÈGLES (choix de l'utilisateur, 19/11/2026) :
 *   - de 0 à 100 % : une tâche dont la fin prévue est au plus tard à la
 *     date d'état passe à 100 %, Début réel et Fin réelle aux dates
 *     prévues ; une tâche à cheval prend « jours ouvrés écoulés jusqu'au
 *     soir de la date d'état / durée ouvrée », avec un Début réel au début
 *     prévu ; une tâche qui commence après reste à 0 % ;
 *   - ne jamais reculer : les dates réelles déjà posées ne bougent pas, et
 *     un avancement n'est jamais diminué ;
 *   - un jalon dont la date est atteinte est franchi ;
 *   - un seul geste annulable.
 *
 * LE JEU, importé, sans lien ; date d'état mercredi 10/06/2026 :
 *   A  01 → 05/06, 0 %              → 100 %, réel 01 → 05 ;
 *   B  08 → 12/06, 0 %              → 60 % (08, 09, 10 : 3 jours sur 5), réel 08 → — ;
 *   C  08 → 12/06, 80 % saisis      → 80 % (jamais moins), réel 08 → — ;
 *   D  15 → 19/06, 0 %              → inchangée ;
 *   F  01 → 05/06, finie le 04      → inchangée (réel 01 → 04) ;
 *   M  jalon le 05/06               → franchi (100 %).
 * JUIN 2026 COMMENCE UN LUNDI et n'a aucun férié.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « bouton « Mettre à jour le projet » absent du panneau de la
 * date d'état ». Les discriminants — le calendrier, le socle importé, la
 * date d'état écrite — passent. */

const CLES = ['A', 'B', 'C', 'D', 'F', 'M'];

function jeu(s) {
    const tache = ([cle, startDate, endDate, extra = {}], ordre) => ({
        id: `jeu-${cle}`, name: `${cle} MaJ ${s}`, description: '', startDate, endDate,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order: ordre, parentId: null,
        isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [], ...extra,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E MettreAJour ${s}`, description: '' },
        tasks: [
            ['A', '2026-06-01', '2026-06-05'],
            ['B', '2026-06-08', '2026-06-12'],
            ['C', '2026-06-08', '2026-06-12', { progress: 80, status: 'in_progress' }],
            ['D', '2026-06-15', '2026-06-19'],
            ['F', '2026-06-01', '2026-06-05', { actualStart: '2026-06-01', actualFinish: '2026-06-04', progress: 100, status: 'done' }],
            ['M', '2026-06-05', '2026-06-05', { isMilestone: true }],
        ].map(tache),
        resources: [],
    };
}

/** « clé:avancement% réel début→fin » pour chaque clé, lu dans le store. */
const lire = (page, s) => page.evaluate(async ({ s, cles }) => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    const taches = store.getTasks();
    return {
        projet: store.getActiveProject()?.name ?? null,
        etat: cles.map(c => {
            const t = taches.filter(x => x.name === `${c} MaJ ${s}`);
            return t.length === 1 ? `${c}:${t[0].progress}% ${t[0].actualStart || '—'}→${t[0].actualFinish || '—'}` : `${c}:${t.length} tâche(s)`;
        }).join(' '),
    };
}, { s: String(s), cles: CLES });

const SOCLE = 'A:0% —→— B:0% —→— C:80% —→— D:0% —→— F:100% 2026-06-01→2026-06-04 M:0% —→—';

test('« Mettre à jour le projet » porte l\'avancement jusqu\'à la date d\'état, sans rien faire reculer, en un geste annulable', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'mettre-a-jour.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(async () => (await lire(page, s)).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE CALENDRIER EST LUNDI-VENDREDI SANS FÉRIÉ du 01 au
       19/06 (compte partagé). Ferme « 60 % viendrait d'un autre compte
       des jours ouvrés ». */
    const ouvres = await page.evaluate(async () => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { workingDaysBetween } = await import(new URL('js/utils.js', base).href);
        const c = store.getCalendar();
        return [workingDaysBetween('2026-06-01', '2026-06-05', c), workingDaysBetween('2026-06-08', '2026-06-12', c), workingDaysBetween('2026-06-08', '2026-06-10', c)];
    });
    expect(ouvres, 'jours ouvrés : 5, 5, 3').toEqual([5, 5, 3]);

    /* DISCRIMINANT — LE SOCLE IMPORTÉ. Ferme « l'avancement attendu
       viendrait de l'import ». */
    expect((await lire(page, s)).etat, 'le socle importé').toBe(SOCLE);

    /* DISCRIMINANT — LA DATE D'ÉTAT EST ÉCRITE (par le panneau de la
       barre). */
    const bouton = page.locator('#dateEtatBtn');
    await bouton.click();
    await page.locator('#dateEtatChamp').fill('2026-06-10');
    await page.locator('#dateEtatChamp').dispatchEvent('change');
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.statusDate ?? null;
    }), { message: 'date d\'état écrite' }).toBe('2026-06-10');

    // --- L'ASSERTION CENTRALE ---
    const maj = page.locator('#dateEtatPopover #mettreAJourBtn');
    await expect(maj, 'bouton « Mettre à jour le projet » absent du panneau de la date d\'état').toHaveCount(1);
    await maj.click();
    const fenetre = page.getByRole('dialog', { name: 'Mettre à jour le projet' });
    await expect(fenetre, 'la fenêtre « Mettre à jour le projet » s\'ouvre').toBeVisible();
    await expect(fenetre.getByLabel('Tout le projet'), 'portée par défaut : tout le projet').toBeChecked();
    await expect(fenetre.getByLabel(/Les tâches sélectionnées/), 'aucune tâche sélectionnée : option indisponible').toBeDisabled();
    await fenetre.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect(fenetre, 'la fenêtre se ferme').toHaveCount(0);

    await expect.poll(async () => (await lire(page, s)).etat, { message: 'avancement porté au 10/06' }).toBe(
        'A:100% 2026-06-01→2026-06-05 B:60% 2026-06-08→— C:80% 2026-06-08→— D:0% —→— F:100% 2026-06-01→2026-06-04 M:100% 2026-06-05→2026-06-05');

    /* Un seul geste : une annulation rend tout le socle. */
    await page.locator('#undoBtn').click();
    await expect.poll(async () => (await lire(page, s)).etat, { message: 'une annulation rend le socle' }).toBe(SOCLE);

    await deleteActiveProject(page);
});
