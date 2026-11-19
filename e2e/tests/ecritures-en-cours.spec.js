import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Les écritures en base parties en arrière-plan se comptent, et s'attendent.
 *
 * LE DÉFAUT, mesuré en intégration (runs 44290728444, 44300290973,
 * 44561118641) : dates-reelles-moteur.spec.js échoue une fois sur deux
 * environ, sur son témoin « après rechargement, relu de la base » — A et
 * son successeur D sont relus à leurs anciennes dates, alors qu'ils étaient
 * justes en mémoire. updateTask() écrit en base dans un setTimeout, et
 * propagateDependencies() sans attendre : la fiche se ferme, le test
 * recharge, et l'écriture partie en arrière-plan est perdue. Un utilisateur
 * qui recharge ou ferme l'onglet dans la seconde perd de même sa
 * modification, sans rien voir. Rien ne permettait de savoir qu'une
 * écriture était en cours.
 *
 * LA RÈGLE (première marche, E1) : store.ecrituresEnCours() compte les
 * écritures en base non terminées — y compris celle qu'updateTask() diffère
 * d'un tour —, et store.attendreEcritures() ne rend la main qu'une fois
 * toutes terminées. Les tests rechargent après l'avoir attendue. (E2,
 * ensuite : avertir avant de quitter la page tant qu'il en reste.)
 *
 * L'appel est gardé : la méthode absente, le test note « absente » et le
 * rouge tombe sur l'assertion centrale, pas sur une exception.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « écritures en cours, puis attendues » : « absente ». Les
 * discriminants passent. */

function jeu(s) {
    return {
        project: { id: 'jeu-projet', name: `E2E EcrituresEnCours ${s}`, description: '' },
        tasks: [{
            id: 'jeu-a', name: `A Ecriture ${s}`, description: '', startDate: '2026-06-01', endDate: '2026-06-05',
            progress: 0, priority: 'medium', status: 'todo', color: '#6366F1', order: 0, parentId: null,
            isMilestone: false, isPhase: false, isPermit: false, assignees: [], dependencies: [],
        }],
        resources: [],
    };
}

const finDeA = (page, nom) => page.evaluate(async (nom) => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    const t = store.getTasks().filter(x => x.name === nom);
    return t.length === 1 ? t[0].endDate : `${t.length} tâche(s)`;
}, nom);

test('les écritures en base parties en arrière-plan se comptent et s\'attendent', async ({ page }) => {
    const s = Date.now();
    const donnees = jeu(s);
    const nomA = donnees.tasks[0].name;

    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({ name: 'ecritures.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(donnees)) });
    await expect.poll(() => page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    }), { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    /* DISCRIMINANT — LE SOCLE : A finit le 05/06. */
    expect(await finDeA(page, nomA), 'A importée, fin au 05/06').toBe('2026-06-05');

    const mesure = await page.evaluate(async (nom) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const a = store.getTasks().find(x => x.name === nom);
        if (typeof store.ecrituresEnCours !== 'function' || typeof store.attendreEcritures !== 'function') {
            store.updateTask(a.id, { endDate: '2026-06-12' });
            return { compteur: 'absente' };
        }
        store.updateTask(a.id, { endDate: '2026-06-12' });
        const pendant = store.ecrituresEnCours();
        await store.attendreEcritures();
        return { compteur: { pendant: pendant > 0, apres: store.ecrituresEnCours() } };
    }, nomA);

    /* DISCRIMINANT — LA MODIFICATION EST FAITE EN MÉMOIRE. */
    expect(await finDeA(page, nomA), 'A modifiée en mémoire').toBe('2026-06-12');

    // --- L'ASSERTION CENTRALE ---
    expect(mesure.compteur, 'écritures en cours, puis attendues').toEqual({ pendant: true, apres: 0 });

    /* TÉMOIN — l'écriture attendue est bien en base. */
    await page.reload();
    await waitForAppReady(page);
    await expect.poll(() => finDeA(page, nomA), { message: 'relue après rechargement', timeout: 15_000 }).toBe('2026-06-12');

    await deleteActiveProject(page);
});
