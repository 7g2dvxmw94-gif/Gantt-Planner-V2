import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), troisième angle après
 * critical-path.spec.js (liens Fin→Début simples) et
 * chemin-critique-liens.spec.js (types et décalages) : le cas où il n'y a
 * PAS de lien du tout.
 *
 * LE DÉFAUT : une tâche que rien ne précède démarre à l'instant zéro.
 *
 *     if (predecessorsOf[id].length === 0) {
 *         es[id] = 0;
 *
 * Le réseau ne dit rien de la date d'une tâche sans prédécesseur — c'est
 * une donnée du planning, posée par l'utilisateur — et le calcul la
 * remplace par zéro. Toutes les tâches non liées se retrouvent donc
 * superposées au même instant fictif, quels que soient les mois qui les
 * séparent réellement.
 *
 * CONSÉQUENCE : LE CALCUL DÉSIGNE LES TÂCHES LES PLUS LONGUES AU LIEU DES
 * DERNIÈRES. À durée égale, deux tâches distantes de deux semaines
 * paraissent finir en même temps, donc toutes deux sans marge. Rien
 * n'oblige à lier les tâches dans cette application : la configuration
 * n'a rien d'exotique.
 *
 * LE VERDICT EST OBJECTIF. Terrassement finit le vendredi 5 juin, le
 * projet s'arrête le vendredi 19, et rien ne suit Terrassement : on peut
 * la retarder de deux semaines sans toucher à la fin du projet. Elle a
 * donc de la marge, et ne peut pas être critique.
 *
 * LE DISCRIMINANT EST LA SECONDE TÂCHE. Enduits est critique dans les deux
 * lectures — la juste comme la fausse —, ce qui établit que le calcul a
 * tourné et que la classe est bien posée, sans rien préjuger du défaut.
 * Sans lui, une absence de surlignage sur Terrassement pourrait seulement
 * vouloir dire que le chemin critique n'a pas été activé.
 *
 * MÊME DURÉE POUR LES DEUX, ET AUCUN WEEK-END À L'INTÉRIEUR. Les durées
 * sont comptées en jours calendaires par ce calcul — limite connue,
 * signalée ailleurs et hors sujet ici. Des durées égales garantissent que
 * l'écart mesuré vient de la DATE et d'elle seule : si les deux tâches
 * étaient de longueurs différentes, un verdict différent pourrait aussi
 * s'expliquer par la durée.
 */

async function creerTache(page, nom, debut, fin) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

const CRITIQUE = /critical-path/;

test('une tâche sans lien qui finit tôt n\'est pas critique', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E CPAncrage ${suffixe}`;
    const nomTot    = `Terrassement ${suffixe}`;
    const nomTard   = `Enduits ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    /* Deux semaines pleines, séparées par une semaine entière. Aucun lien
       n'est créé entre elles : c'est tout l'objet du test. */
    const barreTot  = await creerTache(page, nomTot,  '2026-06-01', '2026-06-05');
    const barreTard = await creerTache(page, nomTard, '2026-06-15', '2026-06-19');

    await page.locator('#criticalPathBtn').click();

    /* DISCRIMINANT — LE CALCUL A TOURNÉ ET LE SURLIGNAGE FONCTIONNE.
       Enduits finit avec le projet : elle est critique dans les deux
       lectures. C'est aussi le point de synchronisation de l'assertion
       négative qui suit. */
    await expect(barreTard).toHaveClass(CRITIQUE, { timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Terrassement finit le 5 juin quand le projet s'arrête le 19, et rien
       ne la suit : dix jours ouvrés de marge. Le calcul la croit pourtant
       sans marge, parce qu'il la fait démarrer au même instant qu'Enduits
       et que les deux tâches ont la même durée. */
    await expect(barreTot).not.toHaveClass(CRITIQUE);

    await deleteActiveProject(page);
});
