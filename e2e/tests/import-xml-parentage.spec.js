import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { xmlMSProjectArborescence, importerXML } from '../msproject.js';

/* Couvre TEST_PLAN.md § G4 étape 6, volet arborescence.
 *
 * Défaut E de l'audit G4, dernier de la liste. Deux causes distinctes qui
 * produisent le même symptôme — un parent faux — et qui sont donc traitées
 * ensemble, mais vérifiées séparément.
 *
 * 1. Les lignes NULLES sont importées. MS Project marque les lignes vides
 *    d'un planning par <IsNull>1</IsNull> (documenté pour Task et Resource).
 *    L'import ne l'examine jamais : le repli `getTag(el,'Name') ||
 *    'Tâche sans nom'` leur fabrique un nom, et elles deviennent des tâches
 *    à part entière. Pire, elles occupent leur niveau dans parentMap et
 *    volent la paternité des tâches qui suivent.
 *
 *    À noter — la boucle des RESSOURCES échappe au défaut par accident :
 *    son garde `!name` écarte les ressources nulles, qui n'ont pas de Name.
 *    Rien d'équivalent ne protège les tâches, justement parce qu'un nom de
 *    repli leur est substitué.
 *
 * 2. parentMap n'est jamais purgé. Les entrées des niveaux profonds
 *    survivent au retour à un niveau supérieur. Une tâche dont le niveau
 *    saute (1 → 3, ce que produisent des fichiers générés par d'autres
 *    outils) se rattache alors à une entrée PÉRIMÉE, laissée par une
 *    branche précédente : un parent pris dans un autre sous-arbre.
 *
 * Les deux tests assertent sur le champ « Phase parente » de la modale,
 * qui donne le parent réellement enregistré — et non sur l'indentation
 * visuelle du Gantt, qui pourrait masquer un parentId erroné.
 */

/** Option actuellement sélectionnée dans le sélecteur de phase parente. */
function parentSelectionne(page) {
    return page.locator('#taskParent option:checked');
}

test('import XML : une ligne nulle n\'est pas importée et ne vole pas la paternité', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E Parentage Accueil ${suffixe}`;
    const nomXml     = `E2E Parentage Nulle ${suffixe}`;
    const phase      = `Phase Gros Oeuvre ${suffixe}`;
    const enfant1    = `Fondations ${suffixe}`;
    const enfant2    = `Elevation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    /* La ligne nulle est glissée ENTRE les deux enfants, au niveau 1 : sans
       le correctif elle devient map[1] et le second enfant se rattache à
       elle au lieu de la phase. */
    await importerXML(page, xmlMSProjectArborescence({
        nomProjet: nomXml,
        taches: [
            { nom: phase, niveau: 1, sommaire: true },
            { nom: enfant1, niveau: 2 },
            { nulle: true, niveau: 1 },
            { nom: enfant2, niveau: 2 },
        ],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXml);
    await trackActiveProject(page);

    const barre = (nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre(enfant2)).toBeVisible({ timeout: 10_000 });

    /* Contrôle SECONDAIRE, et je ne prétends pas qu'il morde : une ligne
       nulle n'a pas de dates, le Gantt ne lui dessinerait donc peut-être
       aucune barre même importée. Le run du commit de test seul tranchera.
       S'il ne tombe pas, c'est cette assertion qui est sans effet — pas le
       défaut qui aurait disparu. */
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: 'Tâche sans nom' }))
        .toHaveCount(0);

    /* L'assertion DÉCISIVE. Sans le correctif, la ligne nulle devient
       map[1] et enfant2 se rattache à elle. Comme elle n'est pas une phase
       (pas de <Summary>), elle ne figure pas dans le sélecteur : celui-ci
       retomberait sur « — Aucune (racine) — » au lieu de la phase. */
    await barre(enfant2).dblclick();
    await expect(parentSelectionne(page)).toHaveText(phase, { timeout: 10_000 });
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nomAccueil }).click();
    await deleteActiveProject(page);
});

test('import XML : un saut de niveau ne rattache pas à une branche précédente', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E Saut Accueil ${suffixe}`;
    const nomXml     = `E2E Saut Importe ${suffixe}`;
    const phase1     = `Phase Une ${suffixe}`;
    const enfant1    = `Enfant de Une ${suffixe}`;
    const phase2     = `Phase Deux ${suffixe}`;
    const orpheline  = `Sautee sous Deux ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    /* Niveaux 1, 2, 1, 3. Au retour au niveau 1 (phase2), l'entrée map[2]
       laissée par enfant1 SURVIT. La tâche de niveau 3 qui suit lit alors
       map[2] et se retrouve rattachée à enfant1 — une tâche d'un tout autre
       sous-arbre, déclarée avant phase2. */
    await importerXML(page, xmlMSProjectArborescence({
        nomProjet: nomXml,
        taches: [
            { nom: phase1, niveau: 1, sommaire: true },
            { nom: enfant1, niveau: 2 },
            { nom: phase2, niveau: 1, sommaire: true },
            { nom: orpheline, niveau: 3 },
        ],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await trackActiveProject(page);

    const barre = (nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre(orpheline)).toBeVisible({ timeout: 10_000 });

    await barre(orpheline).dblclick();
    /* L'assertion centrale : quel que soit le parent retenu, ce ne doit PAS
       être une tâche de la branche de phase1. L'entrée périmée est le
       défaut ; l'absence de parent est un repli acceptable. */
    await expect(parentSelectionne(page)).not.toHaveText(enfant1, { timeout: 10_000 });
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nomAccueil }).click();
    await deleteActiveProject(page);
});
