import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § D1 (glisser-déposer) croisé avec § B7 (dépendances).
 * gantt-drag.spec.js vérifie qu'une tâche LIBRE suit la souris ;
 * task-dependencies.spec.js vérifie qu'une tâche liée est placée par ses
 * contraintes. Personne ne vérifie ce qui arrive quand on glisse une tâche
 * QUI EST liée — et c'est là que les deux règles se contredisent.
 *
 * LE DÉFAUT : le glissement ne réapplique pas les contraintes de la tâche
 * déplacée. applyPredecessorConstraints() n'est appelée que depuis
 * task-modal.js ; le chemin du glissement, lui, se contente de :
 *
 *     updates.skipSnap = true;
 *     store.updateTask(d.taskId, updates);
 *
 * updateTask() propage bien aux SUCCESSEURS, mais ne réapplique jamais à la
 * tâche déplacée ses propres contraintes.
 *
 * L'APPLICATION DIT POURTANT LE CONTRAIRE, DEUX FOIS.
 *
 *   applyPredecessorConstraints : « Application STRICTE : la tâche est
 *   placée exactement où ses contraintes l'exigent. Pour introduire un
 *   écart, il faut un décalage sur le lien — pas un déplacement à la souris,
 *   qui serait perdu au premier mouvement du prédécesseur. »
 *
 *   propagateDependencies : « MÊME calcul que applyPredecessorConstraints :
 *   c'est ce qui garantit qu'un écart ne se comporte pas différemment selon
 *   qu'on déplace le prédécesseur ou le successeur. »
 *
 * C'est exactement cette symétrie que le glissement rompt : déplacer le
 * prédécesseur repositionne le successeur, déplacer le successeur ne fait
 * rien. Même forme qu'en #46, #53 et #55 — un invariant écrit à un endroit
 * et démenti à côté.
 *
 * ET L'ÉCART OBTENU NE TIENT PAS. Le premier commentaire dit pourquoi c'est
 * grave plutôt que seulement incohérent : la position gagnée à la souris
 * sera effacée sans prévenir au prochain mouvement du prédécesseur, par
 * propagateDependencies. L'application accepte donc une modification
 * qu'elle ne sait pas conserver.
 *
 * DÉCOUVERT EN VÉRIFIANT CELA, ET NON TRAITÉ ICI :
 * applyPredecessorConstraints émet un événement `task:constrained` — avec
 * les dates avant/après et la liste des prédécesseurs — au motif que « sans
 * ce signal, l'utilisateur voit sa tâche sauter sans comprendre pourquoi ».
 * Or PERSONNE NE L'ÉCOUTE : un grep sur tout js/ ne trouve que l'émission.
 * Le mécanisme d'information a été construit puis laissé débranché. Ce qui
 * suit ne le rebranche pas : décider quoi montrer à l'utilisateur est une
 * question d'interface, et aucun rouge ne la couvre.
 */

/** Juin 2026 commence un lundi. */
const A_DEBUT = '2026-06-01';   // lundi
const A_FIN   = '2026-06-05';   // vendredi
/* Fin de A + 1 = samedi 6, recalé au lundi 8 ; B garde ses deux jours
   ouvrés, soit lundi 8 → mardi 9. */
const B_CONTRAINT_DEBUT = '2026-06-08';
const B_CONTRAINT_FIN   = '2026-06-09';

const GLISSEMENT_JOURS = 2;

async function creerTache(page, nom, debut, fin) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    /* L'overlay reste cliquable ~200 ms après la fermeture (transition CSS
       sur visibility) et intercepterait un mousedown démarré trop tôt sur la
       barre en dessous — le glissement ne s'enclencherait alors jamais, en
       silence. gantt-drag.spec.js documente déjà ce piège. */
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

/** Rouvre une tâche, vérifie ses dates, referme sans enregistrer. */
async function verifierDates(page, barre, debut, fin) {
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(debut);
    await expect(page.locator('#taskEnd')).toHaveValue(fin);
    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

/** Glisse une barre de `jours` colonnes vers la droite. La largeur d'une
 *  colonne est mesurée dans le DOM plutôt que supposée : au zoom « jour »,
 *  une colonne vaut un jour, mais sa largeur en pixels dépend du rendu. */
async function glisser(page, barre, jours) {
    const largeurColonne = await page.evaluate(() => {
        const col = document.querySelector('.gantt-timeline-grid-col');
        const l = col ? col.getBoundingClientRect().width : 0;
        return l > 0 ? l : 36;
    });
    const boite = await barre.boundingBox();
    const x = boite.x + boite.width / 2;
    const y = boite.y + boite.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + jours * largeurColonne, y, { steps: 10 });
    await page.mouse.up();
}

test('glisser une tâche liée ne l\'arrache pas à ses contraintes', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E GlissementLie ${suffixe}`;
    const nomAmont  = `Fondations ${suffixe}`;
    const nomLibre  = `Voirie ${suffixe}`;
    const nomLie    = `Élévation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // Zoom « jour » : une colonne = un jour, donc un glissement mesurable.
    await page.locator('.zoom-btn[data-zoom="day"]').click();

    const barreAmont = await creerTache(page, nomAmont, A_DEBUT, A_FIN);
    const barreLibre = await creerTache(page, nomLibre, '2026-06-01', '2026-06-02');
    /* La liée naît plus loin, pour que le déplacement opéré par le lien se
       voie et ne soit pas un hasard de position initiale. */
    const barreLiee  = await creerTache(page, nomLie, '2026-06-11', '2026-06-12');

    // Lier Élévation à Fondations en Fin→Début.
    await barreLiee.dblclick();
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    await groupe.locator('.dep-list > div').filter({ hasText: nomAmont })
        .locator('input[type="checkbox"]').check();
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    /* PREMIER DISCRIMINANT — LA CONTRAINTE EXISTE ET S'APPLIQUE. Par la
       modale, Élévation a bien été tirée du 11 au 8 juin. C'est le
       comportement de référence : celui que le glissement devra respecter. */
    await verifierDates(page, barreLiee, B_CONTRAINT_DEBUT, B_CONTRAINT_FIN);

    /* SECOND DISCRIMINANT — MON GLISSEMENT DÉPLACE VRAIMENT UNE BARRE.
       Voirie n'a aucun prédécesseur : elle doit suivre la souris. Sans
       cette vérification, une tâche restée en place plus bas pourrait
       simplement vouloir dire que le glissement n'a pas pris — c'est
       d'ailleurs un piège connu de ce Gantt, l'overlay de la modale
       avalant le mousedown. */
    await glisser(page, barreLibre, GLISSEMENT_JOURS);
    await verifierDates(page, barreLibre, '2026-06-03', '2026-06-04');

    /* --- L'ASSERTION CENTRALE ---
       Élévation est liée : la souris ne peut pas l'arracher à sa contrainte.
       Le glissement doit être corrigé comme le fait déjà la modale, sans
       quoi l'application enregistre une position qu'elle effacera d'elle-même
       au prochain mouvement de Fondations. */
    await glisser(page, barreLiee, GLISSEMENT_JOURS);
    await verifierDates(page, barreLiee, B_CONTRAINT_DEBUT, B_CONTRAINT_FIN);

    await deleteActiveProject(page);
});
