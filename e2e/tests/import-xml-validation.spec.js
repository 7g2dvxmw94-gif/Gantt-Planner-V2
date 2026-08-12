import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G4 par sa face négative : que se passe-t-il quand le
 * fichier .xml n'est PAS un planning MS Project ?
 *
 * DOMParser.parseFromString(..., 'application/xml') ne lève pas sur du XML
 * mal formé — il renvoie un document <parsererror>. importFromMSProjectXML()
 * n'examinait pas ce cas : elle poursuivait, ne trouvait aucune <Task>,
 * fabriquait un projet vide nommé « Projet importé (XML) », le rendait actif,
 * et retournait cet objet. L'appelant (js/app.js, branche ext === 'xml') ne
 * teste que la vérité de la valeur retournée : le toast affiché était donc un
 * toast de SUCCÈS.
 *
 * Le symptôme n'est pas « rien ne se passe » mais « l'utilisateur change de
 * projet sans l'avoir demandé » : le projet en cours disparaît de l'écran au
 * profit d'un projet vide, et rien ne signale l'erreur.
 *
 * Trois entrées sont éprouvées ici parce qu'elles empruntent des chemins
 * DIFFÉRENTS dans le parseur — mesuré sous Chromium, pas supposé :
 *
 *   charge            racine       parsererror   <Task>   rejetée par
 *   ---------------   ----------   -----------   ------   ---------------
 *   XML mal formé     Project           1          1      parsererror seul
 *   XML étranger      catalogue         0          0      absence de Task
 *   HTML renommé      html              1          0      les deux
 *
 * La première ligne est la raison d'être de la garde en deux volets : sur du
 * XML mal formé, Chromium ne rend pas un document vide, il CONSERVE l'arbre
 * partiellement construit et y insère un <parsererror>. Le fichier cassé
 * ci-dessous ressort donc avec une <Task> exploitable — un contrôle limité à
 * « aucune tâche trouvée » l'aurait laissé passer.
 *
 * Symétriquement, la garde ne sur-rejette pas : un fichier MS Project
 * légitimement vide porte sa tâche récapitulative UID 0 et reste importable.
 *
 * NOTE — pourquoi aucune assertion sur le nombre de projets : la CI partage un
 * seul compte Supabase et rien ne sérialise deux workflows (voir cleanup.js).
 * Un run concurrent peut créer ou supprimer un projet entre deux mesures. Les
 * assertions sont donc nominatives.
 */

const CHARGES = [
    {
        cas: 'XML mal formé',
        nom: 'casse.xml',
        contenu: '<?xml version="1.0"?><Project><Tasks><Task><UID>1</UID></Tasks></Project>',
    },
    {
        cas: 'XML valide mais étranger à MS Project',
        nom: 'etranger.xml',
        contenu: '<?xml version="1.0"?><catalogue><article ref="A1"><libelle>Vis</libelle></article></catalogue>',
    },
    {
        cas: 'HTML renommé en .xml',
        nom: 'page.xml',
        contenu: '<!doctype html><html><body><h1>Ceci n\'est pas un planning</h1></body></html>',
    },
];

for (const charge of CHARGES) {
    test(`import XML refusé : ${charge.cas}`, async ({ page }) => {
        const projectName = `E2E XmlInvalide ${Date.now()}`;
        const taskName = `Tâche témoin ${Date.now()}`;

        await page.goto('index.html');
        await createProject(page, projectName);

        await page.locator('#addTaskBtn').click();
        await page.locator('#taskName').fill(taskName);
        await page.locator('#taskStart').fill('2026-09-07');
        await page.locator('#taskEnd').fill('2026-09-09');
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(page.locator('#taskModalOverlay')).toBeHidden();

        const barreTemoin = page.locator('.gantt-bar[data-task-id]').filter({ hasText: taskName });
        await expect(barreTemoin).toBeVisible({ timeout: 10_000 });

        /* L'input file est créé par document.createElement() et n'est jamais
           inséré dans le DOM (js/app.js, _importProject) : page.setInputFiles()
           sur un sélecteur ne le trouverait pas. Seul l'événement filechooser
           permet de l'atteindre. Le nom doit porter l'extension .xml, le tri
           de _importProject() se faisant sur elle. */
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#importBtn').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: charge.nom,
            mimeType: 'application/xml',
            buffer: Buffer.from(charge.contenu, 'utf-8'),
        });

        // 1. L'échec est annoncé.
        await expect(page.locator('#toastContainer .toast', { hasText: "Erreur lors de l'import XML" }))
            .toBeVisible({ timeout: 10_000 });

        /* 2. Et surtout : le projet en cours n'a pas bougé. C'est l'assertion
              qui distingue « l'import a échoué » de « l'import a détourné
              l'application vers un projet fantôme ». */
        await expect(page.locator('#projectName')).toHaveText(projectName);
        await expect(barreTemoin).toBeVisible();

        // 3. Aucun projet fantôme n'a été créé.
        await page.locator('.project-selector').click();
        await expect(page.locator('#projectDropdown')).toBeVisible();
        await expect(
            page.locator('.project-dropdown-item .project-item-name', { hasText: 'Projet importé (XML)' })
        ).toHaveCount(0);

        /* Refermer explicitement : le menu est une bascule au clic et n'a
           aucun gestionnaire pour Escape (_toggleProjectDropdown, js/app.js).
           Le laisser ouvert ferait échouer deleteActiveProject(), qui reclique
           sur le même sélecteur — et le refermerait au lieu de l'ouvrir. */
        await page.locator('.project-selector').click();
        await expect(page.locator('#projectDropdown')).toHaveCount(0);

        await deleteActiveProject(page);
    });
}
