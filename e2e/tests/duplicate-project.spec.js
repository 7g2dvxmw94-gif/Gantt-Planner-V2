import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § A4 (dupliquer un projet).
 *
 * Deux propriétés, et la seconde est celle qui se casse en silence.
 *
 * 1. LA COPIE SURVIT AU RECHARGEMENT. store.duplicateProject() empile le
 *    projet et ses tâches dans l'état local puis émet — sans aucun appel à
 *    Supabase, là où addProject() et importProject() attendent leur
 *    synchronisation. Le test recharge donc la page, seul moyen de
 *    distinguer une copie réellement persistée d'une copie qui n'existe
 *    que dans l'onglet courant.
 *
 * 2. LES DÉPENDANCES SONT REMAPPÉES SUR LA COPIE. Les tâches dupliquées
 *    reçoivent de nouveaux ids ; leurs liens doivent suivre. Un lien resté
 *    pointé sur la tâche d'ORIGINE ne se voit pas : la copie s'affiche
 *    normalement, ses dates sont justes, et l'anomalie n'apparaît qu'au
 *    premier recalcul — ou jamais. On l'observe ici en rouvrant la tâche
 *    successeur dans la copie : son prédécesseur doit être coché, ce qui
 *    n'est possible que si l'id pointe à l'intérieur du projet courant.
 *
 * 3. LES RESSOURCES ET LES ASSIGNÉS SUIVENT. Ni les unes ni les autres ne
 *    voyagent avec les écritures principales : `resourceIds` n'est pas une
 *    colonne de `projects` et les assignés ne sont pas portés par
 *    `upsertTask` — les deux vivent dans des tables de liaison alimentées
 *    par des appels dédiés. Un projet de test sans ressource ni assigné
 *    laisserait donc passer leur absence sans rien signaler, ce qui a été
 *    précisément le cas de la première version de ce test.
 */

const AMONT_DEBUT = '2026-06-01';   // lundi
const AMONT_FIN   = '2026-06-03';   // mercredi

test('dupliquer un projet : la copie survit au rechargement, dépendances remappées', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E Duplication ${suffixe}`;
    const nomAmont = `Amont ${suffixe}`;
    const nomAval  = `Aval ${suffixe}`;
    const nomRessource = `Ressource dup ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    /* Une ressource, rattachée au projet actif à sa création. Elle est
       indispensable au test : sans elle, ni le lien projet-ressource ni
       l'assignation de tâche ne seraient exercés. */
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modalRessource = page.locator('.resource-modal');
    await modalRessource.locator('#resName').fill(nomRessource);
    await modalRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible();
    await page.locator('#tabTimeline').click();

    // --- Deux tâches liées, pour que la copie ait quelque chose à remapper ---
    const creer = async (nom, debut, fin, avecRessource = false) => {
        await page.locator('#addTaskBtn').click();
        const modal = page.locator('#taskModalOverlay');
        await modal.locator('#taskName').fill(nom);
        await modal.locator('#taskStart').fill(debut);
        await modal.locator('#taskEnd').fill(fin);
        if (avecRessource) {
            await modal.locator('.assignee-item', { hasText: nomRessource })
                .locator('input[type="checkbox"]').check();
        }
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(modal).toBeHidden();
    };
    await creer(nomAmont, AMONT_DEBUT, AMONT_FIN);
    await creer(nomAval, '2026-06-15', '2026-06-17', true);

    const barreAval = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomAval });
    await expect(barreAval).toBeVisible({ timeout: 10_000 });
    await barreAval.dblclick();
    const groupePred = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    await groupePred.locator('.dep-list > div').filter({ hasText: nomAmont })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Dupliquer depuis le sélecteur de projet ---
    const nomCopie = `${projectName} (copie)`;
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item', { hasText: 'Dupliquer ce projet' }).click();

    await expect(page.locator('#toastContainer .toast', { hasText: `Projet dupliqué : "${nomCopie}"` }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomCopie);

    /* La copie n'est pas passée par createProject() : le filet de nettoyage
       ne la connaît pas encore. Sans cette ligne, un échec au rechargement
       ci-dessous laisserait deux projets en base au lieu d'un. */
    await trackActiveProject(page);

    // --- Le rechargement repart de l'état serveur ---
    await page.reload();
    await waitForAppReady(page);
    await expect(page.locator('#projectName')).toHaveText(nomCopie);

    const copieAmont = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomAmont });
    const copieAval  = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomAval });
    await expect(copieAmont).toBeVisible({ timeout: 10_000 });
    await expect(copieAval).toBeVisible();

    /* --- Le lien pointe-t-il dans la copie ? ---
       La liste des prédécesseurs ne contient que les tâches du projet
       courant. Une case cochée prouve donc que l'id a été remappé ; un lien
       resté sur la tâche d'origine laisserait la liste entièrement
       décochée, sans autre symptôme visible. */
    await copieAval.dblclick();
    await expect(
        groupePred.locator('.dep-list > div').filter({ hasText: nomAmont })
            .locator('input[type="checkbox"]')
    ).toBeChecked();

    /* L'assigné, dans la même modal : les assignés ne sont pas portés par
       upsertTask() et passent par un appel dédié. Sans lui, la case serait
       décochée après rechargement, sans autre symptôme. */
    await expect(
        page.locator('#taskModalOverlay').locator('.assignee-item', { hasText: nomRessource })
            .locator('input[type="checkbox"]')
    ).toBeChecked();

    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    /* Le lien projet-ressource : la portée par défaut de l'onglet
       Ressources est « Ce projet ». La ressource n'y apparaît que si une
       ligne project_resources existe pour la COPIE — elle ne se déduit pas
       de la table `projects`, qui ne porte aucune colonne resourceIds. */
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible({ timeout: 10_000 });
    await page.locator('#tabTimeline').click();

    // --- Nettoyage : la copie, puis l'original ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});
