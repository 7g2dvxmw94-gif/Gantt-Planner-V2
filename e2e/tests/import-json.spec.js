import { test, expect } from '../fixtures.js';
import { readFileSync } from 'fs';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G1 étape 5 (import) : le fichier JSON exporté
   doit pouvoir être réimporté et restaurer un projet identique (mêmes
   tâches). Round-trip réel : export puis réimport du même fichier
   téléchargé, plutôt qu'une fixture statique. */

test('réimporter un export JSON restaure un projet identique', async ({ page }) => {
    const projectName = `E2E Import ${Date.now()}`;
    const taskName = `Tâche import ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(taskName);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-08-12');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // Exporter en JSON.
    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^JSON$/ }) })
        .click();
    const download = await downloadPromise;
    const filePath = await download.path();

    // Réimporter ce même fichier : store.importProject() crée un NOUVEAU
    // projet (nouveaux ids, tâches remappées) et l'active automatiquement.
    // download.path() pointe vers le fichier temporaire interne de Playwright
    // (nom arbitraire, sans extension) — pas vers le nom suggéré du
    // téléchargement. Sans extension ".json", le tri par extension de
    // _importProject() (js/app.js) tombe dans le cas "format non supporté" et
    // n'importe jamais rien : il faut fournir explicitement un nom de fichier
    // avec la bonne extension via un FilePayload plutôt que le chemin brut.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'export.json',
        mimeType: 'application/json',
        buffer: readFileSync(filePath),
    });

    await expect(page.locator('#toastContainer .toast', { hasText: `"${projectName}"` })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(projectName);
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName })).toBeVisible({ timeout: 10_000 });

    /* La copie importée est le seul projet de la suite qui ne vienne pas de
       createProject() : le filet de nettoyage ne la connaît pas encore. Sans
       cette ligne, un échec entre ici et la fin du test laisserait en base
       exactement le doublon "E2E Import" qu'on a passé la session à traquer. */
    await trackActiveProject(page);

    // Nettoyage : deux projets partagent désormais le même nom (l'original
    // et la copie importée, active) — supprimer l'un puis l'autre. Un
    // rechargement entre les deux repart d'un DOM propre avant de rouvrir
    // le sélecteur de projet.
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});

/* Les ASSIGNÉS survivent-ils au réimport ?
 *
 * Le premier test ci-dessus ne porte que sur le projet et ses tâches. Or
 * les assignés ne voyagent pas avec elles : rowToTask() initialise
 * `assignees: []` avec la mention « rechargé séparément via
 * task_assignees », et importProject() — qui les remappe pourtant en
 * mémoire — n'appelle jamais syncTaskAssignees(). Sans rechargement, rien
 * ne se voit : la copie importée affiche ses assignés jusqu'au prochain
 * chargement, qui les fait disparaître.
 *
 * Même famille que le défaut de duplicateProject() corrigé en #29, à une
 * différence près : l'import ne souffre PAS du manque de lien
 * projet-ressource. Il recrée ses ressources avec project_id pointant sur
 * le nouveau projet — elles lui appartiennent, et se rechargent donc sans
 * table de liaison. La ligne d'assigné existera bien dans la modal ; c'est
 * son état coché qui est en jeu. */
test('les assignés d’une tâche survivent au réimport', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E ImportAssign ${suffixe}`;
    const taskName = `Tâche assignée ${suffixe}`;
    const nomRessource = `Ressource import ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // Une ressource, rattachée au projet actif à sa création.
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modalRessource = page.locator('.resource-modal');
    await modalRessource.locator('#resName').fill(nomRessource);
    await modalRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible();
    await page.locator('#tabTimeline').click();

    // Une tâche qui lui est assignée.
    await page.locator('#addTaskBtn').click();
    const modalTache = page.locator('#taskModalOverlay');
    await modalTache.locator('#taskName').fill(taskName);
    await modalTache.locator('#taskStart').fill('2026-06-01');
    await modalTache.locator('#taskEnd').fill('2026-06-03');
    await modalTache.locator('.assignee-item', { hasText: nomRessource })
        .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modalTache).toBeHidden();

    // --- Export puis réimport du même fichier ---
    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^JSON$/ }) })
        .click();
    const download = await downloadPromise;
    const filePath = await download.path();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    /* Nom de fichier explicite avec l'extension : download.path() renvoie
       un fichier temporaire sans extension, et _importProject() trie par
       extension — leçon du premier test de ce fichier. */
    await fileChooser.setFiles({
        name: 'export.json',
        mimeType: 'application/json',
        buffer: readFileSync(filePath),
    });
    await expect(page.locator('#toastContainer .toast', { hasText: `"${projectName}"` }))
        .toBeVisible({ timeout: 10_000 });

    // La copie importée devient active ; le filet de nettoyage ne la
    // connaît pas, elle ne vient pas de createProject().
    await trackActiveProject(page);

    /* --- Le rechargement est tout l'objet du test ---
       Avant lui, la copie affiche ses assignés depuis l'état mémoire. */
    await page.reload();
    await waitForAppReady(page);

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    await barre.dblclick();
    await expect(
        page.locator('#taskModalOverlay').locator('.assignee-item', { hasText: nomRessource })
            .locator('input[type="checkbox"]')
    ).toBeChecked();
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Nettoyage : la copie, puis l'original (même nom) ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});

/* Restauration d'une sauvegarde GLOBALE (« Tout exporter »).
 *
 * Deuxième point d'entrée d'import, distinct du précédent : le même bouton
 * route vers store.importAllProjects() dès que le fichier porte
 * `type: 'full-backup'`. Il présentait la même omission que
 * importProject() — les assignés jamais écrits dans task_assignees — et a
 * été corrigé en même temps, mais sans test. Voici ce test.
 *
 * LA SAUVEGARDE EST FILTRÉE avant réimport, pour ne garder que le projet
 * du test. Ce n'est pas une commodité : importAllProjects() ne renomme pas
 * les copies, donc restaurer la sauvegarde entière du compte y dupliquerait
 * TOUS les projets — dont le seed persistant, à l'identique. Le doublon
 * porterait alors un nom que le filtre de purge « E2E % » ne rattrape pas,
 * délibérément (voir auth.setup.js). Filtrer garde une empreinte d'un seul
 * projet, tout en conservant la forme réelle d'un export.
 *
 * La personnalisation est vidée pour la même raison : importAllProjects()
 * la fusionne dans les réglages du compte, partagé par toutes les specs. */
test('la restauration d’une sauvegarde globale conserve les assignés', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E Backup ${suffixe}`;
    const taskName = `Tâche sauvegardée ${suffixe}`;
    const nomRessource = `Ressource backup ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modalRessource = page.locator('.resource-modal');
    await modalRessource.locator('#resName').fill(nomRessource);
    await modalRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource })).toBeVisible();
    await page.locator('#tabTimeline').click();

    await page.locator('#addTaskBtn').click();
    const modalTache = page.locator('#taskModalOverlay');
    await modalTache.locator('#taskName').fill(taskName);
    await modalTache.locator('#taskStart').fill('2026-06-01');
    await modalTache.locator('#taskEnd').fill('2026-06-03');
    await modalTache.locator('.assignee-item', { hasText: nomRessource })
        .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modalTache).toBeHidden();

    // --- « Tout exporter » : une vraie sauvegarde globale ---
    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^Tout exporter$/ }) })
        .click();
    const download = await downloadPromise;
    const sauvegarde = JSON.parse(readFileSync(await download.path(), 'utf-8'));
    expect(sauvegarde.type).toBe('full-backup');

    /* Réduite au seul projet du test — voir l'en-tête. On conserve la
       structure produite par l'application plutôt que d'inventer une
       charge utile, dont les champs manquants feraient échouer le test
       pour une tout autre raison. */
    const projet = sauvegarde.projects.find(p => p.name === projectName);
    expect(projet, 'le projet du test doit figurer dans la sauvegarde').toBeTruthy();
    const taches = sauvegarde.tasks.filter(t => t.projectId === projet.id);
    const idsRessources = new Set(taches.flatMap(t => t.assignees || []));
    const filtree = {
        ...sauvegarde,
        projects: [projet],
        tasks: taches,
        resources: sauvegarde.resources.filter(r => idsRessources.has(r.id)),
        customization: {},
    };
    expect(filtree.resources.length,
        'la ressource assignée doit être présente, sinon le test ne prouve rien').toBe(1);

    // --- Réimport via le même bouton ---
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'sauvegarde.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(filtree)),
    });
    await expect(page.locator('#toastContainer .toast', { hasText: 'projet(s) importé(s)' }))
        .toBeVisible({ timeout: 10_000 });

    /* importAllProjects() active le dernier projet restauré : la copie est
       donc le projet actif, et le filet de nettoyage peut l'enregistrer. */
    await trackActiveProject(page);

    await page.reload();
    await waitForAppReady(page);

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    await barre.dblclick();
    await expect(
        page.locator('#taskModalOverlay').locator('.assignee-item', { hasText: nomRessource })
            .locator('input[type="checkbox"]')
    ).toBeChecked();
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Nettoyage : la copie restaurée, puis l'original (même nom) ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});
