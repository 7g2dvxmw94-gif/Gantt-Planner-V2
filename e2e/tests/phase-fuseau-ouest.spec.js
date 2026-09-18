import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B2 (phases) à l'ouest de Greenwich — le seul
 * endroit où le défaut existe, et celui que l'intégration continue ne
 * visite jamais.
 *
 * LE DÉFAUT : _recalculatePhase() mélange les deux façons de lire une
 * date, celle-là même que l'en-tête d'utils.js interdit en capitales.
 *
 *     const dates    = children.map(c => new Date(c.startDate).getTime());
 *     const endDates = children.map(c => new Date(c.endDate).getTime());
 *     phase.startDate = formatDateISO(new Date(Math.min(...dates)));
 *     phase.endDate   = formatDateISO(new Date(Math.max(...endDates)));
 *
 * `new Date('2026-06-10')` est interprété en UTC. `formatDateISO` passe
 * par `parseISO`, qui lit les composantes LOCALES. À l'ouest de
 * Greenwich, minuit UTC tombe la veille en heure locale : la phase recule
 * d'un jour, aux deux bouts.
 *
 * L'INVARIANT N'EST PAS DÉDUIT, IL EST ÉCRIT — dans l'en-tête du module
 * que cette fonction contourne :
 *
 *     PIEGE DE FUSEAU HORAIRE : new Date('2026-05-01') est interprete
 *     en UTC, alors que new Date(2026, 4, 1) l'est en heure locale.
 *     Melanger les deux decale les dates d'un jour pour les
 *     utilisateurs a l'ouest de Greenwich. Tout ce module construit
 *     et lit les dates en LOCAL, exclusivement.
 *
 * `parseISO()` existe pour cela. _recalculatePhase ne l'appelle pas.
 *
 * MESURÉ HORS NAVIGATEUR sur le texte réel de store.js, enfants au
 * 10 et au 12 juin :
 *
 *     Europe/Paris        2026-06-10..2026-06-12   correct
 *     UTC (celui de la CI) 2026-06-10..2026-06-12   correct
 *     America/New_York    2026-06-09..2026-06-11   DÉCALÉE
 *
 * POURQUOI LA SUITE NE L'AVAIT JAMAIS VU : les runners tournent en UTC,
 * où le défaut n'apparaît pas. phase.spec.js vérifie déjà cette enveloppe
 * et passe — il ne se trompe pas, il regarde depuis un endroit d'où le
 * défaut est invisible. Ce fichier ne fait qu'y porter le regard depuis
 * l'ouest.
 *
 * ET LA CONSÉQUENCE EST PERSISTÉE : _recalculatePhase se termine par un
 * upsertTask(phase). La phase décalée part en base.
 */

/* LE SEUL VRAI PARAMÈTRE DE CE TEST. New York est à l'ouest de
   Greenwich toute l'année, été comme hiver — le décalage ne dépend donc
   pas de la date choisie. */
test.use({ timezoneId: 'America/New_York' });

/* Dates éloignées d'aujourd'hui et tombant un jour ouvré, pour les mêmes
   raisons que phase.spec.js : une phase restée sur les valeurs par défaut
   du formulaire, ou recalée par addTask(), serait autrement
   indiscernable. */
const ENFANT_A = { debut: '2026-08-24', fin: '2026-08-26' };   // lundi → mercredi
const ENFANT_B = { debut: '2026-09-07', fin: '2026-09-09' };   // lundi → mercredi

/** Bords gauche et droit d'une barre, en coordonnées écran. Les barres
 *  sont comparées ENTRE ELLES plutôt qu'à des pixels attendus : phase et
 *  tâches sont posées par le même calcul, donc leurs bords coïncident au
 *  pixel près si les dates concordent. */
async function bords(locator) {
    const box = await locator.boundingBox();
    return box && { gauche: box.x, droit: box.x + box.width };
}

async function creerTacheEnfant(page, { nom, debut, fin, phase }) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.locator('#taskParent').selectOption({ label: phase });
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

test('une phase couvre ses enfants aussi à l\'ouest de Greenwich', async ({ page }) => {
    const suffixe   = Date.now();
    const nomPhase  = `Phase Ouest ${suffixe}`;
    const nomA      = `Étude ${suffixe}`;
    const nomB      = `Livraison ${suffixe}`;

    await page.goto('index.html');

    /* PREMIER DISCRIMINANT — LE FUSEAU A BIEN PRIS DANS LE NAVIGATEUR.
       C'est la seule façon dont ce test pourrait mentir : tourner en UTC
       comme les autres, ne rien mesurer de neuf, et passer au vert en
       doublon de phase.spec.js. New York est à UTC-4 ou UTC-5 selon la
       saison, soit un décalage de 240 ou 300 minutes — dans les deux cas
       strictement positif, ce qui est exactement la condition du défaut :
       être à l'ouest de Greenwich. */
    const decalage = await page.evaluate(() => new Date().getTimezoneOffset());
    expect(decalage).toBeGreaterThan(0);

    await createProject(page, `E2E PhaseOuest ${suffixe}`);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="phase"]').click();
    await page.locator('#taskName').fill(nomPhase);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    await creerTacheEnfant(page, { nom: nomA, ...ENFANT_A, phase: nomPhase });
    await creerTacheEnfant(page, { nom: nomB, ...ENFANT_B, phase: nomPhase });

    const barreA   = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomA });
    const barreB   = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomB });
    const barrePhase = page.locator('.gantt-bar.phase-bar');

    /* SECOND DISCRIMINANT — LE MONTAGE EST EN PLACE.
       Une phase sans enfant visible reste masquée (app.js,
       _applyFiltersToTimeline) : la voir établit que les deux tâches lui
       sont bien rattachées, donc que _recalculatePhase a tourné. Sans
       cela, une comparaison de bords porterait sur une barre absente. */
    await expect(barreA).toBeVisible({ timeout: 10_000 });
    await expect(barreB).toBeVisible({ timeout: 10_000 });
    await expect(barrePhase).toBeVisible({ timeout: 10_000 });

    const [bPhase, bA, bB] = await Promise.all([bords(barrePhase), bords(barreA), bords(barreB)]);

    /* --- L'ASSERTION CENTRALE ---
       La phase commence où commence son premier enfant et finit où finit
       le dernier. C'est la définition même d'une phase dans cette
       application, et elle ne dépend d'aucun fuseau.

       Le décalage d'un jour déplace la barre d'une colonne entière ;
       la tolérance d'un pixel ne couvre que l'arrondi de rendu. */
    expect(Math.abs(bPhase.gauche - bA.gauche)).toBeLessThanOrEqual(1);
    expect(Math.abs(bPhase.droit  - bB.droit)).toBeLessThanOrEqual(1);

    await deleteActiveProject(page);
});
