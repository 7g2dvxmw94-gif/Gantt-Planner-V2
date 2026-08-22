import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C4, volets 1 et 6 — affichage du Dashboard et
 * bascule entre projets.
 *
 * DERNIÈRE ZONE du balayage d'échappement, après l'export PDF (#48), les
 * vues Coûts (#49) et l'infobulle (#50).
 *
 * app.js pose plusieurs vues avec innerHTML en y interpolant le nom du
 * projet sans l'échapper :
 *
 *     <div class="dashboard-project-name">${ps.project.name}</div>
 *     <option value="${p.id}"…>${p.name}</option>
 *
 * Un nom contenant des chevrons y est relu comme du balisage :
 * « Chantier <MOA> & Cie » perd son <MOA>.
 *
 * DEUX PORTEURS, chemins distincts et rendus différents : la carte de
 * projet est un <div>, le filtre une <option>. Le second compte
 * doublement, car le contenu d'une <option> n'est pas rendu comme le reste
 * du document — le vérifier écarte l'idée qu'échapper suffirait « partout
 * pareil ».
 *
 * DISCRIMINANT IMPLICITE MAIS RÉEL : createProject() attend que
 * #projectName contienne le nom, par correspondance de SOUS-CHAÎNE. Un
 * en-tête mutilé y ferait donc échouer la création avant même d'atteindre
 * le Dashboard. Que le test parvienne jusqu'ici établit que le nom est
 * intact dans l'application, et impute la troncature aux vues mesurées.
 *
 * Comme pour les trois zones précédentes, le test se garde d'écrire une
 * charge active : montrer que le nom n'arrive pas intact suffit à établir
 * le défaut.
 */

const nomProjetAvecBalisage = (s) => `Chantier <MOA> & Cie ${s}`;

test('le Dashboard n\'interprète pas le nom d\'un projet comme du balisage', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = nomProjetAvecBalisage(suffixe);

    await page.goto('index.html');

    /* createProject() valide déjà l'en-tête #projectName : s'il tronquait
       le nom, l'appel échouerait ici même, et non plus bas. */
    await createProject(page, nomProjet);

    await page.locator('#tabDashboard').click();

    /* Les éléments sont repérés par le SUFFIXE, seul fragment du nom qui
       survive à la troncature : les chercher par leur nom complet les
       rendrait introuvables et transformerait le défaut en simple
       absence. */
    const carte = page.locator('.dashboard-project-name', { hasText: String(suffixe) });

    /* PREMIER DISCRIMINANT — la carte du projet est rendue. Une absence
       signifierait que le Dashboard n'a pas affiché ce projet, et le texte
       manquant plus bas ne prouverait rien. */
    await expect(carte).toBeVisible({ timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       La carte doit porter le nom en entier. Faute d'échappement, « <MOA> »
       est relu comme une balise inconnue et disparaît. */
    await expect(carte).toHaveText(nomProjet);

    /* Le filtre emprunte un autre chemin — une <option>, dont le contenu
       n'est pas rendu comme le reste du document. Asserté APRÈS, pour que
       l'échec le plus probable désigne d'abord le porteur principal. */
    const option = page.locator('#dashboardProjectFilter option', { hasText: String(suffixe) });
    await expect(option).toHaveText(nomProjet);

    await deleteActiveProject(page);
});
