import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § D4 — « Infobulle au survol », jusqu'ici sans
 * aucun test.
 *
 * LE DÉFAUT : _buildTooltipHTML() (gantt-interactions.js) assemble une
 * chaîne HTML et la pose avec innerHTML, sans échapper :
 *
 *     const dot = `<span class="gtt-dot" style="background:${task.color…}">`
 *     let html  = `<div class="gtt-header">${dot}<span class="gtt-title">${task.name}</span></div>`
 *     …
 *     html += `<span>${assigneeNames.join(', ')}</span>`
 *     html += `<div class="gtt-bl-title">${baseline.name}</div>`
 *     …
 *     el.innerHTML = this._buildTooltipHTML(task);
 *
 * Un nom contenant des chevrons y est relu comme du balisage :
 * « Réunion <MOA> & MOE » perd son <MOA>. L'infobulle est censée montrer
 * la tâche telle qu'elle est ; elle en montre une version tronquée.
 *
 * Troisième lieu du même défaut, après l'export PDF (#48) et les vues
 * Coûts (#49). Comme pour ces deux-là, le test se garde d'écrire une
 * charge active : montrer que le nom n'arrive pas intact suffit à établir
 * le défaut, et échapper traite du même coup l'interprétation du balisage
 * sur une page vivante.
 *
 * DEUX PORTEURS, chemins distincts : le nom de la TÂCHE vient de
 * task.name, celui des ASSIGNÉS d'une liste jointe. Corriger l'un sans
 * l'autre laisserait le défaut en place — c'est exactement ce qui s'est
 * produit entre #48 et #49.
 */

const nomTacheAvecBalisage     = (s) => `Réunion <MOA> & MOE ${s}`;
const nomRessourceAvecBalisage = (s) => `Chef <OPC> & Cie ${s}`;

test('l\'infobulle du Gantt n\'interprète pas les noms comme du balisage', async ({ page }) => {
    const suffixe      = Date.now();
    const nomProjet    = `E2E Infobulle ${suffixe}`;
    const nomRessource = nomRessourceAvecBalisage(suffixe);
    const nomTache     = nomTacheAvecBalisage(suffixe);

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Une ressource dont le nom porte des chevrons ---
    await page.locator('#tabResources').click();
    await page.locator('.resource-add-btn').click();
    const modaleRessource = page.locator('.resource-modal');
    await modaleRessource.locator('#resName').fill(nomRessource);
    await modaleRessource.getByRole('button', { name: 'Créer la ressource' }).click();
    await expect(page.locator('.resource-card', { hasText: nomRessource }))
        .toBeVisible({ timeout: 10_000 });

    // --- Une tâche au nom également balisé, assignée à cette ressource ---
    await page.locator('#tabTimeline').click();
    await page.locator('#addTaskBtn').click();
    const modaleTache = page.locator('#taskModalOverlay');
    await modaleTache.locator('#taskName').fill(nomTache);
    await modaleTache.locator('#taskStart').fill('2026-09-07');
    await modaleTache.locator('#taskEnd').fill('2026-09-11');
    await modaleTache.locator('.assignee-item', { hasText: nomRessource })
        .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(modaleTache).toBeHidden({ timeout: 15_000 });

    /* PREMIER DISCRIMINANT — la barre porte le nom ENTIER. Son rendu passe
       par createElement(), qui écrit du texte : le nom est donc intact dans
       l'application, et une troncature dans l'infobulle sera imputable à
       celle-ci, non à la saisie ni au stockage. */
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    // --- Survoler la barre ---
    await barre.hover();
    const infobulle = page.locator('.gantt-hover-tooltip');

    /* DEUXIÈME DISCRIMINANT — l'infobulle s'affiche. Une absence
       signifierait que le survol n'a pas déclenché le rendu, et le texte
       manquant plus bas ne prouverait rien. */
    await expect(infobulle).toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Le titre doit porter le nom en entier. Faute d'échappement, « <MOA> »
       est relu comme une balise inconnue et disparaît. */
    await expect(infobulle.locator('.gtt-title')).toHaveText(nomTache);

    /* Les assignés empruntent un autre chemin — une liste jointe, et non
       task.name. Asserté APRÈS, pour que l'échec le plus probable désigne
       d'abord le porteur principal. */
    await expect(infobulle).toContainText(nomRessource);

    await deleteActiveProject(page);
});
