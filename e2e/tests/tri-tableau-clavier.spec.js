import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § AC1 volets 1 et 3 (« Tab traverse tous les
 * contrôles », « Entrée sur bouton : action déclenchée ») et § AC2 volet 4
 * (« Tables : structure annoncée »). Suite de #53, qui a traité la même
 * famille sur le choix d'une baseline.
 *
 * DEUX DÉFAUTS SUR LE MÊME ÉLÉMENT, mesurés par deux tests distincts.
 *
 * 1. TRIER LE TABLEAU EST IMPOSSIBLE AU CLAVIER. Les en-têtes triables
 *    sont des <th> porteurs d'un gestionnaire de clic, sans tabindex et
 *    sans gestionnaire clavier :
 *
 *        th.className = 'sortable';
 *        th.addEventListener('click', () => { … this._renderBoardView(); });
 *
 *    Un <th> n'est pas focalisable par nature. La colonne ne peut donc être
 *    ni atteinte par Tab, ni activée par Entrée.
 *
 * 2. L'ÉTAT DU TRI N'EST PAS ANNONCÉ. Il n'est porté que par une classe
 *    CSS — sort-asc ou sort-desc — c'est-à-dire par la seule apparence :
 *
 *        th.classList.add(this._tableSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
 *
 *    aria-sort est l'attribut prévu par WAI-ARIA pour cela, et il est
 *    absent de tout le dépôt : un grep sur js/, index.html et les feuilles
 *    de style ne le trouve nulle part. Un lecteur d'écran ne peut donc
 *    savoir ni quelle colonne trie, ni dans quel sens.
 *
 * AUCUN DES DEUX N'EST UNE QUESTION D'APPRÉCIATION : un élément interactif
 * doit être atteignable et opérable au clavier, et aria-sort est
 * l'attribut normalisé pour l'état d'un en-tête de tri. Je ne choisis pas
 * une convention, j'en applique une.
 *
 * LE DISCRIMINANT EST LA SOURIS, dans les deux tests. On exige d'abord que
 * le clic sur l'en-tête inverse bel et bien l'ordre : cela établit que
 * l'en-tête est l'élément qui commande le tri, et cantonne le défaut au
 * chemin clavier — sans quoi un échec plus bas pourrait vouloir dire que
 * le tri ne fonctionne pas du tout.
 */

const ORDRE_CREATION = ['Zeta', 'Alpha'];   // volontairement à l'envers
const ORDRE_ASC      = ['Alpha', 'Zeta'];
const ORDRE_DESC     = ['Zeta', 'Alpha'];

async function prepare(page, nomProjet, suffixe) {
    const nomComplet = (base) => `${base} ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

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
    await expect(cellules).toHaveCount(2, { timeout: 10_000 });

    /* Le tri par défaut est name / asc (app.js, _tableSortKey). L'ordre de
       création étant l'inverse, un tableau qui ne trierait pas du tout se
       distingue déjà ici. */
    const entete = page.locator('th.sortable', { hasText: 'Tâche' });
    await expect(entete).toHaveClass(/sort-asc/);
    await expect(cellules).toHaveText(ORDRE_ASC.map(nomComplet));

    return { entete, cellules, nomComplet };
}

test('trier le tableau est possible au clavier', async ({ page }) => {
    const suffixe = Date.now();
    const { entete, cellules, nomComplet } =
        await prepare(page, `E2E TriClavier ${suffixe}`, suffixe);

    /* DISCRIMINANT — À LA SOURIS, L'EN-TÊTE TRIE. On inverse puis on
       revient, pour repartir de l'état initial. Cela établit que l'en-tête
       commande bien le tri et cantonne le défaut au chemin CLAVIER. */
    await entete.click();
    await expect(entete).toHaveClass(/sort-desc/);
    await expect(cellules).toHaveText(ORDRE_DESC.map(nomComplet));
    await entete.click();
    await expect(entete).toHaveClass(/sort-asc/);
    await expect(cellules).toHaveText(ORDRE_ASC.map(nomComplet));

    /* --- PREMIÈRE ASSERTION CENTRALE : ATTEIGNABLE ---
       Un <th> sans tabindex ne prend pas le focus : l'appel reste sans
       effet. Volet 1 du § AC1. */
    await entete.focus();
    await expect(entete).toBeFocused();

    /* --- SECONDE ASSERTION CENTRALE : OPÉRABLE ---
       Volet 3. Distincte de la première : un tabindex posé sans
       gestionnaire de touches rendrait l'en-tête focalisable mais inerte. */
    await page.keyboard.press('Enter');
    await expect(entete).toHaveClass(/sort-desc/);
    await expect(cellules).toHaveText(ORDRE_DESC.map(nomComplet));

    await deleteActiveProject(page);
});

test('l\'en-tête de tri annonce son état', async ({ page }) => {
    const suffixe = Date.now();
    const { entete, cellules, nomComplet } =
        await prepare(page, `E2E TriAria ${suffixe}`, suffixe);

    /* --- PREMIÈRE ASSERTION CENTRALE ---
       La colonne trie en ordre croissant : aria-sort doit le dire. La
       classe sort-asc, elle, ne parle qu'à l'œil. */
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');

    /* DISCRIMINANT — LE CLIC CHANGE BIEN L'ÉTAT. Vérifié par la classe et
       par l'ordre des lignes, c'est-à-dire par ce qui fonctionne déjà :
       sans cela, un aria-sort resté à « ascending » plus bas pourrait
       seulement vouloir dire que le tri n'a pas basculé. */
    await entete.click();
    await expect(entete).toHaveClass(/sort-desc/);
    await expect(cellules).toHaveText(ORDRE_DESC.map(nomComplet));

    /* --- SECONDE ASSERTION CENTRALE ---
       L'attribut doit suivre le basculement, et pas seulement exister. */
    await expect(entete).toHaveAttribute('aria-sort', 'descending');

    await deleteActiveProject(page);
});
