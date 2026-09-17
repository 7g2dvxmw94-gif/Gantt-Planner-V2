import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B3 (dépendances) sous un angle que
 * task-dependencies.spec.js ne peut pas atteindre : il n'a qu'une chaîne
 * simple, et le défaut demande un LOSANGE.
 *
 * LE DÉFAUT : une tâche déplacée au SECOND passage ne repropage pas.
 *
 *     propagateDependencies(taskId, visited = new Set()) {
 *         if (visited.has(taskId)) return;
 *         visited.add(taskId);
 *         …
 *         this.getSuccessors(taskId).forEach(succ => {
 *             …
 *             succ.startDate = cible.startDate;      // le successeur BOUGE
 *             …
 *             this.propagateDependencies(succ.id, visited);   // mais ceci
 *         });                                                 // peut sortir
 *     }                                                       // aussitôt
 *
 * `visited` est un ensemble GLOBAL à la propagation, pas un marqueur du
 * chemin courant. Il empêche donc la REDESCENTE sous une tâche déjà
 * traversée — alors que le RECALCUL de cette tâche, lui, a bien lieu une
 * seconde fois, dans la boucle du prédécesseur suivant.
 *
 * Une tâche à plusieurs prédécesseurs est donc recalculée autant de fois
 * qu'elle a de prédécesseurs déplacés, et peut bouger au dernier de ces
 * passages — sans que ses propres successeurs en soient informés.
 *
 * LE MONTAGE QUI L'EXPOSE :
 *
 *         ┌─> B (1 j) ─┐
 *     A ──┤            ├─> D (1 j) ──> E (1 j)
 *         └─> C (3 j) ─┘
 *
 * Déplacer A propage vers B puis vers C. Par B, D est recalculée et
 * déplacée, puis E derrière elle. Par C — plus longue, donc dominante —
 * D est recalculée et déplacée ENCORE, mais E ne suit plus : D figure
 * déjà dans `visited`.
 *
 * L'ORDRE DE CRÉATION COMPTE, et c'est pourquoi B est créée avant C.
 * getSuccessors() filtre `this._data.tasks`, dont l'ordre est celui de la
 * création : B est donc traitée en premier. Si C l'était, D prendrait sa
 * valeur définitive dès le premier passage et le défaut ne se
 * manifesterait pas. Le correctif rend l'ordre indifférent — c'est
 * précisément ce qu'on lui demande.
 *
 * LE VERDICT EST OBJECTIF, et il n'y a pas plus objectif dans cet outil :
 * E est liée à D en Fin→Début. Une tâche qui commence AVANT la fin de son
 * prédécesseur viole le lien que l'application impose partout ailleurs —
 * _computeConstrainedDates() ne place jamais un successeur autrement. Le
 * planning enregistré se contredit lui-même, sans message ni trace.
 *
 * Mesuré hors navigateur sur le texte réel de store.js, avant d'écrire ce
 * fichier :
 *
 *     APRES : … D 2026-06-15..2026-06-15   E 2026-06-12..2026-06-12
 *
 * E commence trois jours avant que D ne commence.
 *
 * JUIN 2026 COMMENCE UN LUNDI : le 5 est un vendredi, les 6-7 et 13-14
 * sont des week-ends, les 8 et 15 sont des lundis.
 */

/** Les tâches naissent loin du montage, sur la DURÉE ouvrée voulue ; ce
 *  sont les liens qui les ramènent à leur place. Poser directement les
 *  dates finales rendrait le test aveugle au placement initial. */
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

async function lier(page, barreSuccesseur, nomsPredecesseurs) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    for (const nom of nomsPredecesseurs) {
        await groupe.locator('.dep-list > div').filter({ hasText: nom })
            .locator('input[type="checkbox"]').check();
    }
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

async function verifierDates(page, barre, debut, fin) {
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(debut);
    await expect(page.locator('#taskEnd')).toHaveValue(fin);
    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

test('déplacer une tâche repropage jusqu\'au bout, même par le second chemin d\'un losange', async ({ page }) => {
    const suffixe = Date.now();
    const nomA = `Amont ${suffixe}`;
    const nomB = `Branche courte ${suffixe}`;
    const nomC = `Branche longue ${suffixe}`;
    const nomD = `Jonction ${suffixe}`;
    const nomE = `Finition ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, `E2E Losange ${suffixe}`);

    const barreA = await creerTache(page, nomA, '2026-06-01', '2026-06-02');
    /* B AVANT C : voir l'en-tête du fichier, l'ordre de création décide de
       l'ordre de propagation. */
    const barreB = await creerTache(page, nomB, '2026-06-22', '2026-06-22');  // 1 j ouvré
    const barreC = await creerTache(page, nomC, '2026-06-22', '2026-06-24');  // 3 j ouvrés
    const barreD = await creerTache(page, nomD, '2026-06-22', '2026-06-22');  // 1 j ouvré
    const barreE = await creerTache(page, nomE, '2026-06-22', '2026-06-22');  // 1 j ouvré

    await lier(page, barreB, [nomA]);
    await lier(page, barreC, [nomA]);
    await lier(page, barreD, [nomB, nomC]);
    await lier(page, barreE, [nomD]);

    /* PREMIER DISCRIMINANT — LE MONTAGE EST BIEN EN PLACE.
       Les liens ont ramené chaque tâche à sa position contrainte : D après
       la plus tardive de B et C, E après D. Sans cette vérification, tout
       ce qui suit porterait sur un planning que je n'aurais pas établi. */
    await verifierDates(page, barreB, '2026-06-03', '2026-06-03');
    await verifierDates(page, barreC, '2026-06-03', '2026-06-05');
    await verifierDates(page, barreD, '2026-06-08', '2026-06-08');
    await verifierDates(page, barreE, '2026-06-09', '2026-06-09');

    // L'utilisateur repousse A d'une semaine.
    await barreA.dblclick();
    await page.locator('#taskStart').fill('2026-06-08');
    await page.locator('#taskEnd').fill('2026-06-09');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* SECOND DISCRIMINANT — LA PROPAGATION A ATTEINT LE FOND DU LOSANGE.
       D vaut le 15 juin dans les DEUX lectures, la fautive comme la juste :
       elle est bien recalculée deux fois et retient la contrainte de C, la
       plus tardive. L'exiger établit que la propagation fonctionne jusque
       là, sans rien préjuger du défaut — qui porte sur ce qui vient
       APRÈS D. */
    await verifierDates(page, barreD, '2026-06-15', '2026-06-15');

    /* --- L'ASSERTION CENTRALE ---
       D finit le lundi 15 ; E la suit en Fin→Début, donc le mardi 16.
       Le défaut laisse E au vendredi 12 — trois jours AVANT que D ne
       commence — parce que la seconde visite de D n'a pas redescendu
       jusqu'à elle. */
    await verifierDates(page, barreE, '2026-06-16', '2026-06-16');

    await deleteActiveProject(page);
});
