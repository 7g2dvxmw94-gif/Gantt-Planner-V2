import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G4 étape 5, volet ressources.
 *
 * Les ressources d'un fichier MS Project étaient bien créées à l'import,
 * mais rattachées à RIEN : le projet fabriqué par importFromMSProjectXML()
 * ne portait aucun `resourceIds`, et les ressources aucun `projectId`.
 *
 * Or getProjectResources() parcourt directement project.resourceIds, et la
 * portée par défaut de l'onglet Ressources est « Ce projet ». Les ressources
 * importées étaient donc invisibles DÈS L'IMPORT — pas seulement après un
 * rechargement. Le symptôme est un onglet Ressources vide (« Aucune ressource
 * affectée à ce projet ») sur un projet qui vient pourtant d'en importer.
 *
 * L'assignation de tâche, elle, fonctionnait : les deux mécanismes sont
 * indépendants, ce qui rend le trou d'autant plus discret. C'est pourquoi le
 * test vérifie les DEUX, et non le seul plus visible.
 *
 * Deux branches distinctes du code sont exercées, dans deux tests :
 *
 *   1. Ressource inconnue du compte → elle est créée, puis rattachée.
 *   2. Ressource HOMONYME déjà connue → elle n'est PAS recréée ; c'est son
 *      identifiant existant qui doit être rattaché au projet. Cette branche
 *      remappe déjà les assignés depuis longtemps, mais oubliait le
 *      rattachement — les tâches importées pointaient alors une ressource
 *      que le projet ne déclarait pas.
 *
 * NOTE — les noms portent tous Date.now(). Le dédoublonnage par nom de
 * l'import est GLOBAL au compte, et la CI partage un seul compte Supabase :
 * un nom réutilisé ferait silencieusement pointer l'import sur la ressource
 * d'un autre run.
 */

/** Construit une charge MS Project minimale mais réaliste : tâche
 *  récapitulative UID 0, ressource vide UID 0, et les affectations. */
function xmlMSProject({ nomProjet, nomTache, ressources }) {
    const resLignes = ressources
        .map((nom, i) => `<Resource><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${nom}</Name></Resource>`)
        .join('\n      ');
    const affectations = ressources
        .map((_, i) => `<Assignment><UID>${i}</UID><TaskUID>1</TaskUID><ResourceUID>${i + 1}</ResourceUID></Assignment>`)
        .join('\n      ');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
   <Name>${nomProjet}</Name>
   <Tasks>
      <Task><UID>0</UID><ID>0</ID><Name>${nomProjet}</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>
      <Task><UID>1</UID><ID>1</ID><Name>${nomTache}</Name><OutlineLevel>1</OutlineLevel><Start>2026-09-07T08:00:00</Start><Finish>2026-09-09T17:00:00</Finish><Duration>PT24H0M0S</Duration><PercentComplete>0</PercentComplete></Task>
   </Tasks>
   <Resources>
      <Resource><UID>0</UID><ID>0</ID><Name/></Resource>
      ${resLignes}
   </Resources>
   <Assignments>
      ${affectations}
   </Assignments>
</Project>`;
}

/** L'input file est créé par document.createElement() et jamais inséré dans
 *  le DOM (_importProject, js/app.js) : seul l'événement filechooser permet
 *  de l'atteindre. Le nom doit porter l'extension .xml, le tri se faisant
 *  sur elle. */
async function importerXML(page, contenu) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'planning.xml',
        mimeType: 'application/xml',
        buffer: Buffer.from(contenu, 'utf-8'),
    });
}

test('import XML : les ressources créées sont rattachées au projet importé', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E XmlRessources ${suffixe}`;
    const nomXml = `E2E XmlImporte ${suffixe}`;
    const nomTache = `Tâche XML ${suffixe}`;
    const ressourceA = `Ressource XML A ${suffixe}`;
    const ressourceB = `Ressource XML B ${suffixe}`;
    const ressourceTemoin = `Ressource témoin ${suffixe}`;

    await page.goto('index.html');
    /* Un projet d'accueil : l'import doit basculer DEPUIS un projet réel,
       et il donne au filet de nettoyage une prise dès la première ligne. */
    await createProject(page, projectName);

    /* Une ressource TÉMOIN, rattachée au projet d'accueil et absente du XML.
       Elle rend le contrôle de portée déterministe : compter les ressources
       du compte entier ne le serait pas, la CI partageant un seul compte dont
       le contenu varie. Le témoin, lui, doit apparaître en portée « Toutes
       les ressources » et disparaître en portée « Ce projet » une fois sur le
       projet importé — ce qui établit que le filtre filtre réellement, et
       donc que le comptage à 2 ci-dessous prouve quelque chose. */
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modalTemoin = page.locator('.resource-modal');
    await modalTemoin.locator('#resName').fill(ressourceTemoin);
    await modalTemoin.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: ressourceTemoin })).toBeVisible({ timeout: 10_000 });
    await page.locator('#tabTimeline').click();

    await importerXML(page, xmlMSProject({
        nomProjet: nomXml,
        nomTache,
        ressources: [ressourceA, ressourceB],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXml);

    /* Le projet importé ne vient pas de createProject() : le filet ne le
       connaît pas encore. Inoffensif tant que l'import n'écrit pas en base,
       indispensable dès que ce sera le cas. */
    await trackActiveProject(page);

    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    /* --- L'onglet Ressources, en portée « Ce projet » (celle par défaut) ---
       C'est l'assertion qui mord : elle ne passe que si project.resourceIds
       contient les deux identifiants. Rien d'autre ne les y met. */
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: ressourceA })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.resource-card', { hasText: ressourceB })).toBeVisible();
    await expect(page.locator('.resource-card')).toHaveCount(2);
    // Le témoin appartient au projet d'accueil : il ne doit PAS être là.
    await expect(page.locator('.resource-card', { hasText: ressourceTemoin })).toHaveCount(0);

    /* Le même écran en portée « Toutes les ressources » : le témoin réapparaît.
       Ce couple d'assertions établit que la portée « Ce projet » filtre
       réellement — sans quoi le comptage à 2 ci-dessus ne prouverait rien. */
    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    await expect(page.locator('.resource-card', { hasText: ressourceTemoin })).toBeVisible();
    await expect(page.locator('.resource-card', { hasText: ressourceA })).toBeVisible();

    // --- L'assignation de la tâche, mécanisme distinct du rattachement ---
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
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});

test('import XML : une ressource homonyme déjà connue est rattachée, pas dupliquée', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E XmlHomonyme ${suffixe}`;
    const nomXml = `E2E XmlHomonymeImport ${suffixe}`;
    const nomTache = `Tâche homonyme ${suffixe}`;
    const ressource = `Ressource partagée ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // La ressource existe AVANT l'import, sous le nom exact du <Resource>.
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modalRessource = page.locator('.resource-modal');
    await modalRessource.locator('#resName').fill(ressource);
    await modalRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toBeVisible({ timeout: 10_000 });
    await page.locator('#tabTimeline').click();

    await importerXML(page, xmlMSProject({
        nomProjet: nomXml,
        nomTache,
        ressources: [ressource],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXml);
    await trackActiveProject(page);

    /* La branche de remappage. La ressource ne doit pas être recréée — un
       seul exemplaire dans tout le compte — et son identifiant EXISTANT doit
       être rattaché au projet importé. */
    await page.locator('#tabResources').click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(1);

    await page.locator('.resource-scope-btn', { hasText: 'Toutes les ressources' }).click();
    await expect(page.locator('.resource-card', { hasText: ressource })).toHaveCount(1);

    /* Et l'assigné pointe bien cette ressource-là : sans le rattachement, la
       tâche référencerait une ressource que son projet ne déclare pas. */
    await page.locator('#tabTimeline').click();
    await page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }).dblclick();
    await expect(
        page.locator('#taskModalOverlay').locator('.assignee-item', { hasText: ressource })
            .locator('input[type="checkbox"]')
    ).toBeChecked();
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: projectName }).first().click();
    await deleteActiveProject(page);
});
