import { test, expect } from '../fixtures.js';
import fs from 'node:fs/promises';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § G4 étape 6, volet export.
 *
 * Défaut C de l'audit G4, seconde moitié : <PredecessorLink> n'est pas
 * émis à l'export, pas plus qu'il n'était lu à l'import (traité en #37).
 *
 * Ce n'est pas une lacune anodine : l'infobulle du bouton d'export promet
 * noir sur blanc « une importation fidèle dans MS Project AVEC LES
 * DÉPENDANCES » (js/app.js:1829). L'utilisateur exporte donc en croyant
 * emporter son enchaînement, et récupère un fichier où chaque tâche
 * flotte librement. La promesse faite par l'interface est fausse.
 *
 * Le test emploie DEUX types de lien, comme celui de l'import : avec un
 * seul, un correctif émettant <Type>1</Type> en dur passerait au vert.
 *
 * Il asserte sur le CONTENU du fichier produit, et non sur un aller-retour
 * export→réimport. Un aller-retour ne prouverait que la cohérence de
 * l'application avec elle-même : deux erreurs symétriques s'annuleraient
 * et le test resterait vert. Ce qui compte est ce qu'un lecteur MS Project
 * recevra.
 */

/** Découpe le XML en blocs <Task>…</Task> et les indexe par nom de tâche.
 *  Évite de dépendre de l'ordre d'émission. */
function tachesParNom(xml) {
    const blocs = xml.match(/<Task>[\s\S]*?<\/Task>/g) || [];
    const index = {};
    for (const bloc of blocs) {
        const nom = (bloc.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1];
        const uid = (bloc.match(/<UID>(\d+)<\/UID>/) || [])[1];
        if (nom) index[nom] = { uid, bloc };
    }
    return index;
}

test('export XML : les liens de précédence et leur type sont émis', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E ExportLiens ${suffixe}`;
    const tacheA    = `Socle ${suffixe}`;
    const tacheB    = `SuiteSS ${suffixe}`;
    const tacheC    = `SuiteFS ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    const creerTache = async (nom, debut, fin) => {
        await page.locator('#addTaskBtn').click();
        await page.locator('#taskName').fill(nom);
        await page.locator('#taskStart').fill(debut);
        await page.locator('#taskEnd').fill(fin);
        await page.getByRole('button', { name: 'Créer' }).click();
        /* Délai explicite : ce test crée trois tâches coup sur coup, et le
           délai par défaut de 5 s s'est révélé trop court sous la charge du
           runner partagé — la fermeture de la modale a été constatée flaky
           (échec puis succès au réessai). L'assertion reste juste ; c'est
           seulement sa patience qui était mal calibrée. */
        await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    };

    await creerTache(tacheA, '2026-09-07', '2026-09-08');
    await creerTache(tacheB, '2026-09-09', '2026-09-10');
    await creerTache(tacheC, '2026-09-11', '2026-09-14');

    const groupePred = () => page.locator('.form-group', {
        has: page.locator('.form-label', { hasText: 'Précédée par' }),
    });
    const barre = (nom) => page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });

    // B suit A en Début→Début : un type NON défaut, que l'export doit rendre.
    await expect(barre(tacheB)).toBeVisible({ timeout: 10_000 });
    await barre(tacheB).dblclick();
    const ligneB = groupePred().locator('.dep-list > div').filter({ hasText: tacheA });
    await ligneB.locator('input[type="checkbox"]').check();
    await ligneB.locator('select').selectOption('SS');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // C suit A en Fin→Début, le type par défaut.
    await barre(tacheC).dblclick();
    const ligneC = groupePred().locator('.dep-list > div').filter({ hasText: tacheA });
    await ligneC.locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    // --- Exporter et lire le fichier réellement produit ---
    await page.locator('#exportBtn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^XML$/ }) })
        .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xml$/);
    const xml = await fs.readFile(await download.path(), 'utf-8');

    const taches = tachesParNom(xml);
    expect(taches[tacheA]).toBeTruthy();
    expect(taches[tacheB]).toBeTruthy();
    expect(taches[tacheC]).toBeTruthy();

    const uidA = taches[tacheA].uid;

    /* B : lien vers A, Type 3 (SS). La table vient de la documentation
       Microsoft — élément Type, parent PredecessorLink : 0=FF, 1=FS,
       2=SF, 3=SS. */
    expect(taches[tacheB].bloc).toContain('<PredecessorLink>');
    expect(taches[tacheB].bloc).toContain(`<PredecessorUID>${uidA}</PredecessorUID>`);
    expect(taches[tacheB].bloc).toContain('<Type>3</Type>');

    // C : même prédécesseur, Type 1 (FS).
    expect(taches[tacheC].bloc).toContain(`<PredecessorUID>${uidA}</PredecessorUID>`);
    expect(taches[tacheC].bloc).toContain('<Type>1</Type>');

    // A n'a pas de prédécesseur : aucun lien ne doit lui être attaché.
    expect(taches[tacheA].bloc).not.toContain('<PredecessorLink>');

    await deleteActiveProject(page);
});
