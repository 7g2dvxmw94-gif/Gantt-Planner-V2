import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Calendrier par projet, C1 : le moteur de planification lit le calendrier
 * du PROJET actif.
 *
 * LE BESOIN : sur un projet partagé, chaque membre calculait les dates
 * avec le calendrier de SON compte (settings.customization.calendar). C0
 * (#169) a donné au projet son calendrier en base ; le moteur l'ignorait.
 *
 * LA RÈGLE : store.getCalendar() — le calendrier de tout le moteur — est
 * celui du projet actif s'il en a un, sinon celui du compte (projets
 * antérieurs à C0). Le calendrier du compte n'est pas modifié.
 *
 * Jeu : A lun. 01/06 → ven. 05/06/2026 ; B, successeur fin-début de A,
 * deux jours ouvrés, importé trop tôt (03/06 → 04/06). Le calendrier du
 * projet ouvre le samedi : B doit démarrer le samedi 06/06, et non le
 * lundi 08/06 que donne le calendrier du compte.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « B démarre le samedi, ouvré au calendrier du projet » :
 * 2026-06-08. Les discriminants passent. */

function jeu(s) {
    const tache = (id, nom, debut, fin, order, deps) => ({
        id, name: `${nom} CalMoteur ${s}`, description: '', startDate: debut, endDate: fin,
        progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order, parentId: null,
        isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: deps,
    });
    return {
        project: { id: 'jeu-projet', name: `E2E CalendrierMoteur ${s}`, description: '' },
        tasks: [
            tache('jeu-a', 'A', '2026-06-01', '2026-06-05', 0, []),
            tache('jeu-b', 'B', '2026-06-03', '2026-06-04', 1, [{ taskId: 'jeu-a', type: 'FS', lag: 0 }]),
        ],
        resources: [],
    };
}

/** Recale B sur ses liens et rend ses dates, et le calendrier du compte. */
const recalerB = (page, nomB) => page.evaluate(async (nomB) => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    const b = store.getTasks().find(t => t.name === nomB);
    store.applyPredecessorConstraints(b.id);
    const apres = store.getTask(b.id);
    return {
        debut: apres.startDate, fin: apres.endDate,
        compte: JSON.stringify(store.getSettings().customization?.calendar ?? null),
    };
}, nomB);

test('le moteur de planification lit le calendrier du projet actif', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const nomB = donnees.tasks[1].name;

    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'calendrier-moteur.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE CALENDRIER DU COMPTE CHÔME LE SAMEDI. Ferme « le
       samedi était déjà ouvré » (compte partagé : un autre test a pu
       changer son calendrier). */
    const ouvresCompte = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getSettings().customization?.calendar?.workingDays ?? [1, 2, 3, 4, 5];
    });
    expect(ouvresCompte, 'le samedi est chômé au calendrier du compte').not.toContain(6);

    /* DISCRIMINANT — SANS CALENDRIER DE PROJET, LE LIEN PLACE B LE LUNDI.
       Ferme « le lien ne recale pas B » : le rouge ne prouverait rien. */
    const sansCal = await recalerB(page, nomB);
    expect({ debut: sansCal.debut, fin: sansCal.fin }, 'sans calendrier de projet, B du lundi 08/06 au mardi 09/06')
        .toEqual({ debut: '2026-06-08', fin: '2026-06-09' });

    /* DISCRIMINANT — LE CALENDRIER DU PROJET EST ÉCRIT (C0). */
    const ecrit = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.setProjectCalendar(store.getActiveProject().id,
            { workingDays: [1, 2, 3, 4, 5, 6], holidays: [], useFrenchHolidays: false, alsaceMoselle: false });
    });
    expect(ecrit, 'calendrier du projet écrit').toBe(true);

    const avecCal = await recalerB(page, nomB);

    /* DISCRIMINANT — LE CALENDRIER DU COMPTE N'A PAS BOUGÉ. */
    expect(avecCal.compte, 'calendrier du compte inchangé').toBe(sansCal.compte);

    // --- L'ASSERTION CENTRALE ---
    expect(avecCal.debut, 'B démarre le samedi, ouvré au calendrier du projet').toBe('2026-06-06');
    expect(avecCal.fin, 'et finit le lundi 08/06, deux jours ouvrés').toBe('2026-06-08');

    await deleteActiveProject(page);
});
