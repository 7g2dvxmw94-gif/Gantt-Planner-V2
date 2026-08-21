import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C4, volet coûts — suite directe de #48.
 *
 * #48 a corrigé l'export PDF, qui interpolait les noms dans du HTML sans
 * les échapper. Son cadrage était TROP ÉTROIT : le même défaut existe dans
 * la vue Coûts de l'application elle-même.
 *
 *     tableRows += `<tr class="costs-task-row…">
 *         <td class="costs-task-name">${tc.task.name}</td>
 *         <td>${resNames}</td>`
 *     …
 *     container.innerHTML = `…${tableRows}…`
 *
 * Et c'est plus grave qu'à l'export : innerHTML sur la page vivante, et
 * non un document imprimable. Un nom contenant des chevrons y est relu
 * comme du balisage — « Réunion <MOA> & MOE » perd son <MOA> — et les
 * projets se partageant entre comptes, le nom vient parfois d'ailleurs.
 *
 * Le test se garde d'écrire une charge active : montrer que le nom
 * n'arrive pas intact suffit à établir le défaut, et échapper traite les
 * deux conséquences.
 *
 * DEUX PORTEURS, car ils empruntent des chemins différents : le nom de la
 * TÂCHE vient de tc.task.name, celui de la RESSOURCE d'une liste jointe
 * (resNames). Corriger l'un sans l'autre laisserait le défaut en place.
 */

const nomTacheAvecBalisage    = (s) => `Réunion <MOA> & MOE ${s}`;
const nomRessourceAvecBalisage = (s) => `Chef <OPC> & Cie ${s}`;

test('la vue Coûts n\'interprète pas les noms comme du balisage', async ({ page }) => {
    const suffixe      = Date.now();
    const nomProjet    = `E2E CoutsEchap ${suffixe}`;
    const nomRessource = nomRessourceAvecBalisage(suffixe);
    const nomTache     = nomTacheAvecBalisage(suffixe);

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Une ressource dont le nom porte des chevrons ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(nomRessource);
    await modaleRessource.locator('.res-rate-toggle-btn', { hasText: 'Taux horaire' }).click();
    await modaleRessource.locator('#resRate').fill('10');
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();

    /* PREMIER DISCRIMINANT — la carte de ressource porte le nom ENTIER.
       Ce rendu passe par createElement(), qui écrit du texte : le nom est
       donc intact dans l'application, et une mutilation constatée plus bas
       sera imputable à la vue Coûts, non à la saisie ni au stockage. */
    await expect(page.locator('.resource-card', { hasText: nomRessource }))
        .toBeVisible({ timeout: 10_000 });

    // --- Une tâche au nom également balisé, assignée à cette ressource ---
    await page.locator('#tabTimeline').click();
    await page.locator('#addTaskBtn').click();
    const modaleTache = page.locator('#taskModalOverlay');
    await modaleTache.locator('#taskName').fill(nomTache);
    await modaleTache.locator('#taskStart').fill('2026-09-07');
    await modaleTache.locator('#taskEnd').fill('2026-09-09');
    await modaleTache.locator('.assignee-item', { hasText: nomRessource })
        .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modaleTache).toBeHidden({ timeout: 15_000 });

    /* DEUXIÈME DISCRIMINANT — la barre du Gantt porte elle aussi le nom
       entier, pour la même raison. */
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    // --- La vue Coûts ---
    await page.locator('#tabCosts').click();

    /* La ligne est repérée par le SUFFIXE, seul fragment du nom qui
       survive à la mutilation : la chercher par son nom complet la rendrait
       introuvable et transformerait le défaut en simple absence. */
    const ligne = page.locator('tr.costs-task-row', { hasText: String(suffixe) });
    await expect(ligne).toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Le nom de la tâche doit figurer en entier. Faute d'échappement,
       « <MOA> » est relu comme une balise inconnue et disparaît. */
    await expect(ligne.locator('td').nth(0)).toHaveText(nomTache);

    /* Le nom de la ressource emprunte un autre chemin — une liste jointe,
       et non tc.task.name. Asserté APRÈS, pour que l'échec le plus probable
       désigne d'abord le porteur principal. */
    await expect(ligne.locator('td').nth(1)).toHaveText(nomRessource);

    await deleteActiveProject(page);
});
