import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1 (vue Timeline) à l'ouest de Greenwich.
 *
 * CE FICHIER CORRIGE UNE AFFIRMATION QUE J'AI ÉCRITE DANS #70. J'y ai dit
 * des lectures de dates de gantt-renderer.js qu'elles « ne servent qu'à
 * POSITIONNER des barres, et toutes passent par le même calcul — un
 * décalage uniforme ne se verrait pas ». C'est faux : le décalage n'est
 * pas uniforme, et il se voit.
 *
 * LE DÉFAUT : deux chemins mènent à _dateToPosition(), et ils ne partent
 * pas du même endroit.
 *
 *     // une barre de tâche — minuit UTC
 *     const left = this._dateToPosition(new Date(task.startDate));
 *
 *     // la ligne du jour — un instant LOCAL
 *     const today = new Date();
 *     today.setHours(0, 0, 0, 0);
 *     const pos = this._dateToPosition(today);
 *
 * et _dateToPosition ramène son argument à minuit LOCAL :
 *
 *     const d = new Date(date);
 *     d.setHours(0, 0, 0, 0);
 *
 * À l'ouest de Greenwich, minuit UTC du 10 juin est le 9 juin à 20 h
 * locales : setHours() le ramène au 9. La ligne du jour, elle, part déjà
 * d'un instant local et ne bouge pas. Les barres reculent d'une colonne,
 * la grille et la ligne du jour restent en place.
 *
 * Mesuré hors navigateur, les deux chemins pour la MÊME journée :
 *
 *     Europe/Paris       barre colonne 9   aujourd'hui colonne 9
 *     UTC                barre colonne 9   aujourd'hui colonne 9
 *     America/New_York   barre colonne 8   aujourd'hui colonne 9
 *     Pacific/Honolulu   barre colonne 8   aujourd'hui colonne 9
 *
 * CE DÉFAUT N'ABÎME AUCUNE DONNÉE — contrairement à celui de #70, il ne
 * touche que l'affichage. Mais un planning dont les barres sont décalées
 * d'un jour par rapport à sa propre grille se lit faux, et rien ne le
 * signale.
 *
 * L'ÉCART ATTENDU EST CALCULÉ, PAS CODÉ EN DUR. Le test ne suppose ni la
 * date du jour ni la largeur des colonnes : il demande au navigateur le
 * nombre de jours entre aujourd'hui et la tâche, mesure la largeur d'une
 * colonne sur deux divisions voisines du fond de grille, et compare. Il reste donc
 * juste quel que soit le jour où il tourne.
 *
 * LA CIBLE TOMBE UN JOUR OUVRÉ, à dessein : addTask() recale les dates
 * sur les jours ouvrés, et une tâche posée un samedi serait déplacée —
 * l'écart mesuré ne viendrait plus du seul défaut.
 */

test.use({ timezoneId: 'America/New_York' });

test('une barre s\'aligne sur sa colonne aussi à l\'ouest de Greenwich', async ({ page }) => {
    const suffixe = Date.now();
    const nomTache = `Jalonnement ${suffixe}`;

    await page.goto('index.html');

    /* PREMIER DISCRIMINANT — LE FUSEAU A PRIS DANS LE NAVIGATEUR.
       Sans lui, le test tournerait en UTC, ne mesurerait rien de neuf et
       passerait au vert sans que rien ne le signale. New York est à
       UTC-4 ou UTC-5 : décalage strictement positif, ce qui EST la
       condition du défaut. */
    expect(await page.evaluate(() => new Date().getTimezoneOffset())).toBeGreaterThan(0);

    /* La cible : une semaine plus tard, reportée au lundi si elle tombe
       un week-end. Tout est calculé en heure LOCALE dans la page, donc
       dans le même référentiel que la ligne du jour. */
    const { cible, ecartJours } = await page.evaluate(() => {
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);
        const d = new Date(aujourdhui);
        d.setDate(d.getDate() + 7);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { cible: iso, ecartJours: Math.round((d - aujourdhui) / 86400000) };
    });

    await createProject(page, `E2E GanttOuest ${suffixe}`);

    /* SECOND DISCRIMINANT — LE ZOOM EST CONNU ET LINÉAIRE EN JOURS.
       Aux zooms « mois » et « quarter », _dateToPosition() place la date
       en FRACTION de colonne mensuelle : une mesure en colonnes-jour n'y
       aurait aucun sens. Le zoom par défaut conviendrait, mais il est
       relu des réglages du compte (settings.zoomLevel) — donc héritable
       d'un autre test sur ce compte partagé. On le pose. */
    await page.locator('.zoom-btn[data-zoom="day"]').click();
    await expect(page.locator('.zoom-btn[data-zoom="day"]')).toHaveClass(/active/);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nomTache);
    await page.locator('#taskStart').fill(cible);
    await page.locator('#taskEnd').fill(cible);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* TROISIÈME DISCRIMINANT — LA TÂCHE N'A PAS ÉTÉ RECALÉE.
       addTask() déplace une tâche posée un jour chômé. La cible est déjà
       un jour ouvré, mais le vérifier établit que l'écart mesuré plus bas
       ne vient que du rendu. */
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(cible);
    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* QUATRIÈME DISCRIMINANT — LA LIGNE DU JOUR EST RENDUE.
       C'est le repère de la mesure : absente, la comparaison n'aurait
       aucun sens. */
    const ligneJour = page.locator('.today-line');
    await expect(ligneJour).toBeAttached();

    /* Largeur d'une colonne, MESURÉE et non supposée : elle dépend du
       zoom et du thème.

       `.gantt-timeline-grid-col` est le fond de grille, découpé par JOUR
       aux zooms jour et semaine. Une première version prenait
       `.gantt-timeline-cell` — qui est la zone de droite d'UNE LIGNE de
       tâche, donc unique ici : `.nth(1)` n'existait pas et le test
       échouait sur son propre instrument, sans jamais mesurer le défaut.
       C'est le run 35360796405 qui l'a dit. */
    const colonnes = page.locator('.gantt-timeline-grid-col');
    await expect(colonnes.nth(1)).toBeAttached({ timeout: 10_000 });
    const [c0, c1] = await Promise.all([
        colonnes.nth(0).boundingBox(), colonnes.nth(1).boundingBox(),
    ]);
    const largeurColonne = c1.x - c0.x;
    expect(largeurColonne).toBeGreaterThan(0);

    const [boiteBarre, boiteLigne] = await Promise.all([
        barre.boundingBox(), ligneJour.boundingBox(),
    ]);

    /* --- L'ASSERTION CENTRALE ---
       La barre doit se trouver exactement `ecartJours` colonnes à droite
       de la ligne du jour. Le défaut la place une colonne trop à gauche :
       l'écart mesuré vaut alors (ecartJours - 1) colonnes.

       La tolérance d'un pixel ne couvre que l'arrondi de rendu — un jour
       entier vaut une colonne, soit plusieurs dizaines de pixels. */
    const attendu = ecartJours * largeurColonne;
    const mesure  = boiteBarre.x - boiteLigne.x;
    expect(Math.abs(mesure - attendu)).toBeLessThanOrEqual(1);

    await deleteActiveProject(page);
});
