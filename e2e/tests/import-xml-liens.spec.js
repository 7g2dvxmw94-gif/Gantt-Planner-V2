import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { xmlMSProjectAvecLiens, importerXML } from '../msproject.js';

/* Couvre TEST_PLAN.md § G4 étape 6, volet relations.
 *
 * Défaut C de l'audit G4 : <PredecessorLink> n'est jamais lu à l'import.
 * Le mot n'apparaît nulle part dans js/. Un planning MS Project perd donc
 * TOUTES ses relations en franchissant l'import — les tâches arrivent, leur
 * enchaînement non. Sur un planning de chantier, c'est l'essentiel de
 * l'information : les dates seules ne disent pas ce qui commande quoi.
 *
 * Les deux conventions coïncident, ce qui rend le mappage direct :
 * task.dependencies[] porte les PRÉDÉCESSEURS de la tâche (js/store.js:87),
 * et <PredecessorLink> vit à l'intérieur de la <Task> qu'il contraint.
 *
 * Le test emploie DEUX types de lien différents, et c'est délibéré : avec
 * un seul, un correctif qui écrirait 'FS' en dur passerait au vert. Les
 * valeurs numériques viennent de la documentation Microsoft (élément Type,
 * parent PredecessorLink) : 0=FF, 1=FS, 2=SF, 3=SS.
 *
 * L'assertion porte sur la ligne de dépendance de la modale — case cochée
 * et type sélectionné — et non sur les dates des tâches. Un lien peut
 * déclencher un recalcul de planning ; asserter des dates mêlerait deux
 * mécanismes et rendrait l'échec ambigu.
 */

/** Ouvre la modale d'une tâche et renvoie la ligne « Précédée par »
 *  correspondant au prédécesseur nommé. */
function lignePredecesseur(page, nomPredecesseur) {
    const groupe = page.locator('.form-group', {
        has: page.locator('.form-label', { hasText: 'Précédée par' }),
    });
    return groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
}

test('import XML : les liens de précédence et leur type sont importés', async ({ page }) => {
    const suffixe    = Date.now();
    const nomAccueil = `E2E XmlLiens Accueil ${suffixe}`;
    const nomXml     = `E2E XmlLiens Importe ${suffixe}`;
    const tacheA     = `Tâche Socle ${suffixe}`;
    const tacheB     = `Tâche SuiteFS ${suffixe}`;
    const tacheC     = `Tâche SuiteSS ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomAccueil);

    /* B suit A en Fin→Début (Type 1), C suit A en Début→Début (Type 3).
       Deux types distincts : un correctif codant 'FS' en dur échouerait
       sur C. */
    await importerXML(page, xmlMSProjectAvecLiens({
        nomProjet: nomXml,
        taches: [
            { nom: tacheA },
            { nom: tacheB, predecesseurs: [{ uid: 1, type: 1 }] },
            { nom: tacheC, predecesseurs: [{ uid: 1, type: 3 }] },
        ],
    }));

    await expect(page.locator('#toastContainer .toast', { hasText: nomXml }))
        .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#projectName')).toHaveText(nomXml);
    await trackActiveProject(page);

    const barre = (nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre(tacheB)).toBeVisible({ timeout: 10_000 });

    // --- B : prédécesseur A, en Fin→Début ---
    await barre(tacheB).dblclick();
    await expect(lignePredecesseur(page, tacheA).locator('input[type="checkbox"]'))
        .toBeChecked({ timeout: 10_000 });
    await expect(lignePredecesseur(page, tacheA).locator('select')).toHaveValue('FS');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- C : même prédécesseur, mais en Début→Début ---
    await barre(tacheC).dblclick();
    await expect(lignePredecesseur(page, tacheA).locator('input[type="checkbox"]')).toBeChecked();
    await expect(lignePredecesseur(page, tacheA).locator('select')).toHaveValue('SS');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    /* --- Les liens survivent au rechargement ---
       dependencies est une colonne jsonb portée par upsertTask (persistance
       livrée en #36) : rien de plus n'est requis côté écriture, mais mieux
       vaut le constater que le supposer. */
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nomXml })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nomXml);

    await expect(barre(tacheB)).toBeVisible({ timeout: 10_000 });
    await barre(tacheB).dblclick();
    await expect(lignePredecesseur(page, tacheA).locator('input[type="checkbox"]')).toBeChecked();
    await expect(lignePredecesseur(page, tacheA).locator('select')).toHaveValue('FS');
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Nettoyage ---
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: nomAccueil })
        .click({ timeout: 10_000 });
    await expectProjectName(page, nomAccueil);
    await deleteActiveProject(page);
});
