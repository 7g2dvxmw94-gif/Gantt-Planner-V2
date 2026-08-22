import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C2, volets 1 à 3 — vue Tableau et tri
 * alphabétique. C'était la dernière section fonctionnelle du plan sans
 * couverture dédiée.
 *
 * LE DÉFAUT : le tri compare des points de code, pas des lettres.
 *
 *     case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase();
 *     …
 *     if (va < vb) return -1 * dir;
 *
 * L'opérateur < sur des chaînes JavaScript compare unité de code par unité
 * de code. Les lettres accentuées se trouvant au-dessus de « z » dans
 * Unicode, « étude » (é = U+00E9, soit 233) passe après « zonage »
 * (z = 122). Et à l'intérieur d'un mot, « aménagement » passe après
 * « amiante », puisque é (233) est comparé à i (105).
 *
 * Dans une application française, dont l'interface et les jours fériés le
 * sont, « tri alphabétique » désigne l'ordre alphabétique français, où é
 * se range avec e. localeCompare(…, 'fr') le fait ; l'opérateur < non.
 *
 * L'ORDRE DE CRÉATION EST DÉLIBÉRÉMENT BROUILLÉ. Les trois ordres — celui
 * de création, celui que le code produit, et l'ordre français — sont deux
 * à deux distincts :
 *
 *     création : Zonage | Étude de sol | Amiante | Aménagement
 *     actuel   : Amiante | Aménagement | Zonage | Étude de sol
 *     français : Aménagement | Amiante | Étude de sol | Zonage
 *
 * Sans cette précaution, un tableau qui ne trierait pas du tout pourrait
 * passer par accident.
 *
 * Deux inversions distinctes sont ainsi mesurées d'un coup : l'accent en
 * tête de mot (Étude), et l'accent au milieu (Aménagement).
 */

/* Termes du bâtiment, dans l'ordre où le test les crée. */
const ORDRE_CREATION = ['Zonage', 'Étude de sol', 'Amiante', 'Aménagement'];
const ORDRE_FRANCAIS = ['Aménagement', 'Amiante', 'Étude de sol', 'Zonage'];

test('la vue Tableau trie les noms selon l\'alphabet français', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E TriTableau ${suffixe}`;
    const nomComplet = (base) => `${base} ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    /* Mêmes dates pour toutes : un tri par date produirait alors l'ordre de
       création, encore un ordre distinct des deux autres. */
    for (const base of ORDRE_CREATION) {
        await page.locator('#addTaskBtn').click();
        const modale = page.locator('#taskModalOverlay');
        await modale.locator('#taskName').fill(nomComplet(base));
        await modale.locator('#taskStart').fill('2026-09-07');
        await modale.locator('#taskEnd').fill('2026-09-09');
        await page.getByRole('button', { name: 'Créer' }).click();
        await expect(modale).toBeHidden({ timeout: 15_000 });
    }

    await page.locator('#tabBoard').click();
    const cellules = page.locator('.table-task-name');

    /* PREMIER DISCRIMINANT — les quatre tâches sont bien dans le tableau.
       Un compte différent signifierait que la vue n'a pas tout rendu, et
       l'ordre constaté plus bas ne prouverait rien. */
    await expect(cellules).toHaveCount(4, { timeout: 10_000 });

    /* DEUXIÈME DISCRIMINANT — le tableau trie bien PAR NOM, en ordre
       croissant : l'en-tête « Tâche » porte le marqueur sort-asc. Sans
       cela, un ordre inattendu pourrait venir d'un tri sur une autre
       colonne, et non de la comparaison des noms. */
    await expect(page.locator('th.sortable', { hasText: 'Tâche' }))
        .toHaveClass(/sort-asc/);

    /* --- L'ASSERTION CENTRALE ---
       L'ordre alphabétique français. Le code compare des points de code :
       il place Aménagement après Amiante, et Étude de sol après Zonage. */
    await expect(cellules).toHaveText(ORDRE_FRANCAIS.map(nomComplet));

    await deleteActiveProject(page);
});
