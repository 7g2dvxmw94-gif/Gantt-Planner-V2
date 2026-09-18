import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B3 (dépendances), sur le RETOUR À L'UTILISATEUR.
 *
 * LE DÉFAUT : un signal est émis, et personne ne l'écoute.
 *
 * applyPredecessorConstraints() (store.js) termine par :
 *
 *     // Informer l'interface : sans ce signal, l'utilisateur voit sa
 *     // tache sauter sans comprendre pourquoi.
 *     this._emit('task:constrained', {
 *         taskId, from, to,
 *         predecessors: [{ name, type, lag }, …],
 *     });
 *
 * L'événement porte tout ce qu'il faut — les dates avant et après, et les
 * prédécesseurs responsables, nommés. Mais un grep sur tout js/ ne trouve
 * que l'émission : AUCUN abonné. Le mécanisme d'information a été
 * construit, puis laissé débranché. La justification écrite dans le
 * commentaire décrit donc exactement ce qui se produit.
 *
 * CE N'EST PAS UN DÉFAUT DE CALCUL. Les dates sont justes — c'est même
 * tout le sujet : la tâche est déplacée À RAISON, et l'utilisateur n'en
 * sait rien. glissement-contraintes.spec.js l'avait relevé sans le
 * traiter, au motif que « décider quoi montrer à l'utilisateur est une
 * question d'interface, et aucun rouge ne la couvre ». C'est exact, et
 * c'est pourquoi l'arbitrage a été demandé plutôt que tranché ici.
 *
 * CE QUI A ÉTÉ ARBITRÉ : une marque persistante sur la barre, levée au
 * prochain enregistrement de la tâche — plutôt qu'un bandeau éphémère,
 * qu'un journal des recalages, ou que la suppression pure et simple de
 * l'émission. Ce test vérifie les deux moitiés de cette décision : la
 * marque APPARAÎT quand la contrainte déplace la tâche, et elle DISPARAÎT
 * au prochain enregistrement. Sans la seconde, une marque définitive
 * passerait aussi.
 *
 * LA MARQUE NE PORTE QU'UN GLYPHE EN TEXTE VISIBLE, le détail étant dans
 * son nom accessible. Ce n'est pas un choix d'esthète : les barres sont
 * repérées ici par `filter({ hasText })`, et une marque affichant le nom
 * du prédécesseur ferait que la barre de la tâche recalée répondrait au
 * nom de son prédécesseur. Le test ne saurait plus de quelle barre il
 * parle.
 *
 * JUIN 2026 COMMENCE UN LUNDI.
 */

const AMONT_DEBUT = '2026-06-01';   // lundi
const AMONT_FIN   = '2026-06-05';   // vendredi

/* La tâche liée naît VOLONTAIREMENT plus loin que sa position contrainte :
   sans cela, le lien ne la déplacerait pas, aucun recalage n'aurait lieu,
   et il n'y aurait rien à signaler. Fin de l'amont + 1 = samedi 6, recalé
   au lundi 8 ; la liée garde ses deux jours ouvrés. */
const LIEE_DEBUT  = '2026-06-11';
const LIEE_FIN    = '2026-06-12';
const RECALE_DEBUT = '2026-06-08';
const RECALE_FIN   = '2026-06-09';

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

test('une tâche déplacée par ses contraintes le signale sur sa barre', async ({ page }) => {
    const suffixe  = Date.now();
    const nomAmont = `Fondations ${suffixe}`;
    const nomLiee  = `Élévation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, `E2E Recalage ${suffixe}`);

    const barreAmont = await creerTache(page, nomAmont, AMONT_DEBUT, AMONT_FIN);
    const barreLiee  = await creerTache(page, nomLiee, LIEE_DEBUT, LIEE_FIN);

    // Lier la seconde à la première en Fin→Début : c'est l'enregistrement
    // de ce lien qui déclenche applyPredecessorConstraints().
    await barreLiee.dblclick();
    await page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) })
        .locator('.dep-list > div').filter({ hasText: nomAmont })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* PREMIER DISCRIMINANT — LE RECALAGE A BIEN EU LIEU.
       C'est la condition même de ce qu'on veut voir signalé : si la tâche
       n'avait pas bougé, exiger une marque n'aurait aucun sens, et son
       absence ne prouverait rien. On rouvre et on annule — annuler
       n'enregistre pas, donc ne lève pas la marque. */
    await expect(barreLiee).toBeVisible({ timeout: 10_000 });
    await barreLiee.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(RECALE_DEBUT);
    await expect(page.locator('#taskEnd')).toHaveValue(RECALE_FIN);
    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* SECOND DISCRIMINANT — LA MARQUE N'EST PAS PEINTE PARTOUT.
       L'amont n'a pas été déplacé par qui que ce soit : sa barre ne doit
       rien porter. Sans cela, une implémentation qui décorerait toutes
       les barres satisferait l'assertion centrale sans rien distinguer.
       Cette attente vaut aussi bien avant qu'après le correctif. */
    await expect(barreAmont.locator('.gantt-bar-recalage')).toHaveCount(0);

    /* --- L'ASSERTION CENTRALE, PREMIÈRE MOITIÉ ---
       La barre de la tâche recalée porte une marque, et cette marque dit
       POURQUOI : son nom accessible nomme le prédécesseur responsable.
       Une pastille muette laisserait l'utilisateur devant le même
       « pourquoi ma tâche a-t-elle sauté ? ». */
    const marque = barreLiee.locator('.gantt-bar-recalage');
    await expect(marque).toBeVisible({ timeout: 10_000 });
    await expect(marque).toHaveAttribute('aria-label', new RegExp(nomAmont));

    /* --- L'ASSERTION CENTRALE, SECONDE MOITIÉ ---
       « Persistante jusqu'au prochain enregistrement » : on rouvre la
       tâche et on enregistre sans rien changer. La marque doit tomber.
       Ré-enregistrer ne redéplace rien — la tâche est déjà là où ses
       contraintes l'exigent — donc aucune nouvelle marque ne la remplace. */
    await barreLiee.dblclick();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(barreLiee.locator('.gantt-bar-recalage')).toHaveCount(0);

    await deleteActiveProject(page);
});
