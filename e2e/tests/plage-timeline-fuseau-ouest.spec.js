import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E1 (niveaux de zoom) à l'ouest de Greenwich.
 *
 * TROISIÈME OCCURRENCE DU MÊME PIÈGE, et la plus sévère. #70 l'a trouvé
 * dans _recalculatePhase(), #71 dans gantt-renderer.js ; le voici dans
 * getTimelineRange(), qui décide de l'étendue de TOUTE la frise.
 *
 *     const starts   = tasks.map(t => new Date(t.startDate).getTime());
 *     const ends     = tasks.map(t => new Date(t.endDate).getTime());
 *     const minDate  = new Date(Math.min(...starts));
 *     const maxDate  = new Date(Math.max(...ends));
 *     …
 *     const mEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
 *
 * `new Date('2026-09-01')` vaut minuit UTC. `maxDate.getMonth()` lit les
 * composantes LOCALES. À l'ouest de Greenwich, minuit UTC du 1er septembre
 * est le 31 août à 20 h : getMonth() répond AOÛT, et la frise s'arrête au
 * 31 août — la veille du jour où finit la dernière tâche du projet.
 *
 * L'INVARIANT N'EST PAS DÉDUIT, IL EST ÉCRIT, dans l'en-tête d'utils.js :
 *
 *     PIEGE DE FUSEAU HORAIRE : new Date('2026-05-01') est interprete
 *     en UTC, alors que new Date(2026, 4, 1) l'est en heure locale.
 *     Melanger les deux decale les dates d'un jour pour les
 *     utilisateurs a l'ouest de Greenwich.
 *
 * Cette ligne mélange précisément les deux, sur la même expression.
 *
 * CE N'EST PAS UN DÉCALAGE UNIFORME — c'est une colonne QUI MANQUE.
 * Mesuré hors navigateur sur le texte réel de store.js, une tâche unique
 * du 10 août au 1er septembre 2026, au zoom « mois » :
 *
 *     Europe/Paris       Août 2026, Septembre 2026
 *     UTC (celui de la CI) Août 2026, Septembre 2026
 *     America/New_York   Août 2026                    SEPTEMBRE ABSENT
 *     Pacific/Honolulu   Août 2026                    SEPTEMBRE ABSENT
 *     Asia/Tokyo         Août 2026, Septembre 2026
 *
 * LA CONSÉQUENCE VA AU-DELÀ DE L'EN-TÊTE. _dateToPosition() parcourt ces
 * mêmes mois et, pour une date qui n'en fait partie d'aucun, retombe sur
 * l'offset final — le bord droit de la grille. La barre de la tâche est
 * donc tronquée au 31 août, et le planning affirme une fin qu'il n'a pas.
 *
 * LE DÉFAUT SE VOIT AUSSI PAR L'AUTRE BOUT, plus discrètement : une
 * tâche commençant un 1er du mois fait apparaître une colonne vide du
 * mois précédent. Ce test ne porte pas là-dessus — une colonne en trop
 * est du blanc, une colonne en moins est une information perdue.
 *
 * POURQUOI LA SUITE NE L'AVAIT JAMAIS VU : les runners tournent en UTC,
 * où le défaut n'existe pas. zoom-levels.spec.js visite bien le zoom
 * « mois » et passe — il ne se trompe pas, il regarde depuis un endroit
 * d'où le défaut est invisible.
 *
 * LES DEUX DATES SONT DES JOURS OUVRÉS, à dessein : le 10 août 2026 est
 * un lundi, le 1er septembre un mardi. addTask() recale les dates sur les
 * jours ouvrés, et un 1er du mois tombant un week-end serait reporté au
 * lundi suivant — donc dans le bon mois, et le défaut disparaîtrait de
 * lui-même. Le troisième discriminant vérifie que ce recalage n'a pas eu
 * lieu.
 */

test.use({ timezoneId: 'America/New_York' });

const TACHE = { debut: '2026-08-10', fin: '2026-09-01' };   // lundi → mardi

test('la frise couvre le mois où finit la dernière tâche, aussi à l\'ouest de Greenwich', async ({ page }) => {
    const suffixe = Date.now();
    const nomTache = `Chantier ${suffixe}`;

    await page.goto('index.html');

    /* PREMIER DISCRIMINANT — LE FUSEAU A PRIS DANS LE NAVIGATEUR.
       Sans lui le test tournerait en UTC, ne mesurerait rien de neuf et
       passerait au vert en doublon de zoom-levels.spec.js. New York est
       à UTC-4 ou UTC-5 : décalage strictement positif, ce qui EST la
       condition du défaut. */
    expect(await page.evaluate(() => new Date().getTimezoneOffset())).toBeGreaterThan(0);

    await createProject(page, `E2E PlageOuest ${suffixe}`);

    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nomTache);
    await page.locator('#taskStart').fill(TACHE.debut);
    await page.locator('#taskEnd').fill(TACHE.fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache });
    await expect(barre).toBeVisible({ timeout: 10_000 });

    /* SECOND DISCRIMINANT — LE ZOOM EST BIEN « MOIS ».
       C'est le seul zoom où la frise est découpée en colonnes mensuelles
       et où getTimelineRange() cale ses bornes sur des mois ; aux zooms
       jour et semaine elle ajoute un rembourrage de 14 jours qui absorbe
       le décalage. Le zoom est relu des réglages du compte
       (settings.zoomLevel), donc héritable d'un autre test sur ce compte
       partagé : on le pose explicitement. */
    await page.locator('.zoom-btn[data-zoom="month"]').click();
    await expect(page.locator('.zoom-btn[data-zoom="month"]')).toHaveClass(/active/);

    /* TROISIÈME DISCRIMINANT — LA TÂCHE N'A PAS ÉTÉ RECALÉE.
       addTask() déplace une tâche posée un jour chômé. Les deux dates
       sont déjà ouvrées, mais le vérifier établit que la frise est bien
       calculée sur le 1er septembre, et non sur une date voisine. */
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(TACHE.debut);
    await expect(page.locator('#taskEnd')).toHaveValue(TACHE.fin);
    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    const entetes = page.locator('.timeline-month-name');
    await expect(entetes.first()).toBeVisible({ timeout: 10_000 });
    const mois = await entetes.allInnerTexts();

    /* QUATRIÈME DISCRIMINANT — L'EN-TÊTE EST BIEN LU.
       Le mois de DÉBUT est présent des deux côtés de Greenwich : l'exiger
       établit que le sélecteur désigne les bonnes divisions, que le zoom
       « mois » est rendu et que les libellés sont ceux qu'on attend —
       sans quoi l'assertion centrale échouerait pour une raison qui
       n'aurait rien à voir avec le défaut. */
    expect(mois).toContain('Août 2026');

    /* --- L'ASSERTION CENTRALE ---
       Une frise qui s'arrête avant la fin de son propre projet ne montre
       pas le planning : elle en montre une partie, sans le dire. */
    expect(mois).toContain('Septembre 2026');

    await deleteActiveProject(page);
});
