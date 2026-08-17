import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { xmlMSProject, importerXML } from '../msproject.js';

/* Couvre TEST_PLAN.md § G4 étapes 5 et 6, volet persistance.
 *
 * Défaut A de l'audit G4, le principal : importFromMSProjectXML() n'écrit
 * RIEN côté serveur. Elle pousse le projet, les tâches et les ressources
 * dans this._data, appelle _save(), et s'arrête là. Tout ce qui est importé
 * vit donc uniquement en mémoire et dans le stockage local : au premier
 * rechargement, initFromSupabase() reconstruit l'état depuis la base et
 * l'import disparaît en entier.
 *
 * C'est la troisième récidive du motif corrigé en #29 et #30 : une écriture
 * locale considérée comme terminée alors que rien n'est parti sur le réseau.
 *
 * Le rechargement est donc l'assertion centrale de ces deux tests, et non un
 * détail de mise en scène. Sans lui, tout passe déjà aujourd'hui — c'est
 * précisément ce qui rend le défaut discret.
 *
 * NOTE — les noms portent tous Date.now(). Le dédoublonnage par nom de
 * l'import est GLOBAL au compte, et la CI partage un seul compte Supabase :
 * un nom réutilisé ferait silencieusement pointer l'import sur la ressource
 * d'un autre run.
 */

/** Retrouve un projet par son nom via le sélecteur, plutôt que de se fier au
 *  projet actif. Après un rechargement, activeProjectId peut désigner un
 *  projet que la base ne connaît pas : l'application retombe alors sur un
 *  autre projet sans rien signaler. Passer par le sélecteur rend l'absence
 *  du projet importé franchement visible. */
async function ouvrirProjet(page, nom) {
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nom })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nom);
}

test('import XML : le projet importé survit à un rechargement', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E XmlPersist Accueil ${suffixe}`;
    const nomXml     = `E2E XmlPersist Importe ${suffixe}`;
    const nomTache   = `Tâche importée ${suffixe}`;
    const ressourceA = `Ressource Persist A ${suffixe}`;
    const ressourceB = `Ressource Persist B ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    await importerXML(page, xmlMSProject({
        nomProjet: nomXml,
        nomTache,
        ressources: [ressourceA, ressourceB],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXml);

    /* Le projet importé ne vient pas de createProject() : le filet de
       nettoyage ne le connaît pas encore. */
    await trackActiveProject(page);

    // État avant rechargement — déjà couvert par import-xml-resources.spec.js,
    // repris ici pour que l'échec distingue « jamais importé » de « perdu au
    // rechargement ».
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    // --- L'assertion centrale : recharger, puis tout revérifier ---
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomXml);

    // La tâche importée
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    // Les ressources, en portée « Ce projet » (celle par défaut)
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: ressourceA })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.resource-card', { hasText: ressourceB })).toBeVisible();
    await expect(page.locator('.resource-card')).toHaveCount(2);

    /* L'assignation. Elle ne transite PAS par upsertTask() : rowToTask()
       initialise assignees à [] et attend task_assignees. C'est exactement le
       trou corrigé en #30 pour l'import JSON, et l'import XML le reproduit. */
    await page.locator('#tabTimeline').click();
    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }).dblclick();
    await expect(
        page.locator('#taskModalOverlay').locator('.assignee-item', { hasText: ressourceA })
            .locator('input[type="checkbox"]')
    ).toBeChecked();
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Nettoyage : le projet importé (actif), puis le projet d'accueil ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomAccueil);
    await deleteActiveProject(page);
});

test('import XML : une ressource homonyme empruntée reste rattachée après rechargement', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E XmlEmprunt Accueil ${suffixe}`;
    const nomXml     = `E2E XmlEmprunt Importe ${suffixe}`;
    const nomTache   = `Tâche empruntée ${suffixe}`;
    const ressource  = `Ressource Empruntee ${suffixe}`;

    /* Dette de couverture laissée par #33, et levée ici.
     *
     * Le dédoublonnage par nom a deux branches. Celle de la ressource
     * INCONNUE est couverte depuis #33 : la ressource est créée avec
     * projectId = projet importé, donc figure dans ownedIds et survit.
     *
     * Celle-ci est l'autre : la ressource existe déjà sur le compte et
     * appartient à un AUTRE projet. Elle n'est pas recréée, c'est son
     * identifiant existant qui est rattaché. Or _loadProjectData() ÉCRASE
     * project.resourceIds par `ownedIds ∪ linkedIds` : une ressource
     * empruntée n'est ni l'un ni l'autre tant que l'import n'écrit pas sa
     * ligne project_resources. Le rattachement local est donc effacé au
     * premier chargement du projet.
     *
     * #33 ne pouvait pas tester cette branche : sans écriture serveur, seule
     * une assertion posée AVANT le chargement asynchrone serait passée — une
     * assertion racée, qui aurait masqué le défaut. Le rechargement ci-dessous
     * est ce qui la rend enfin honnête. */

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    // La ressource naît dans le projet d'accueil : c'est lui son propriétaire.
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(ressource);
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toBeVisible();

    // Le XML déclare une ressource de MÊME NOM : l'import doit emprunter
    // l'existante, pas en créer une seconde.
    await importerXML(page, xmlMSProject({
        nomProjet: nomXml,
        nomTache,
        ressources: [ressource],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await trackActiveProject(page);

    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomXml);

    /* Portée « Ce projet » : la ressource empruntée doit y figurer, et une
       seule fois — l'import ne doit pas avoir créé de doublon homonyme. */
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(1);

    // --- Nettoyage : projet importé, puis la ressource, puis l'accueil ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await ouvrirProjet(page, nomAccueil);

    await page.locator('#tabResources').click();
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.resource-card', { hasText: ressource })
        .locator('.resource-action-delete').click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(0);

    await page.locator('#tabTimeline').click();
    await deleteActiveProject(page);
});
