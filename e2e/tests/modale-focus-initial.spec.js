import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § AC1 (navigation au clavier) et § AC2.5 (annonce
 * des modales).
 *
 * LE DÉFAUT : la fenêtre de tâche ne donne jamais le focus à son premier
 * champ, alors que son code le demande.
 *
 *     // js/task-modal.js — fin de openCreate()
 *     this._show();               // = this._overlay.classList.add('active')
 *     this._taskName.focus();
 *
 * L'appel est là, il ne fait rien. La cause est dans le CSS :
 *
 *     .modal-overlay        { visibility: hidden;
 *                             transition: opacity …, visibility …; }
 *     .modal-overlay.active { visibility: visible; }
 *
 * _show() pose la classe, puis focus() s'exécute dans la MÊME tâche
 * synchrone. Le recalcul de style DÉMARRE alors la transition, et à
 * l'instant zéro d'une transition la valeur calculée est encore celle de
 * départ — `visibility: hidden`. Un élément dont la visibilité calculée
 * est `hidden` n'est pas focalisable : focus() est un no-op, sans erreur
 * ni trace dans la console.
 *
 * CE N'EST PAS UNE COURSE. Le premier test ci-dessous a d'abord été écrit
 * comme simple discriminant d'un autre défaut, et il a échoué en réessayant
 * vingt-quatre fois sur dix secondes sans jamais réussir une seule fois.
 * Le focus n'arrive pas tard : il n'arrive pas.
 *
 * LA CONSÉQUENCE DÉPASSE LE CHAMP DE SAISIE, et c'est l'objet du second
 * test. Le focus reste sur <body>, hors de la fenêtre. Or le piège à focus
 * de task-modal.js ne réagit que si document.activeElement est le PREMIER
 * ou le DERNIER contrôle de la modale :
 *
 *     if (e.shiftKey) { if (document.activeElement === first) … }
 *     else            { if (document.activeElement === last)  … }
 *
 * Parti de <body>, Tab ne rencontre jamais ces bornes et s'échappe vers
 * l'en-tête, derrière le voile. L'échec de l'auto-focus DÉSARME le piège
 * — celui-ci suppose que le focus est déjà dans la fenêtre, ce que
 * personne ne garantit.
 *
 * LE VERDICT EST OBJECTIF DANS LES DEUX CAS. Une fenêtre qui pose
 * `aria-modal="true"` promet que rien au dehors n'est atteignable, et son
 * propre code dit où le focus doit aller. Il n'y a ici aucun choix
 * d'interface à arbitrer : l'application est en désaccord avec elle-même.
 */

async function ouvrirFenetreDeTache(page, nomProjet) {
    await page.goto('index.html');
    await createProject(page, nomProjet);
    await page.locator('#addTaskBtn').click();

    /* DISCRIMINANT COMMUN — LA FENÊTRE EST BIEN OUVERTE. Sans lui, un
       focus resté sur le corps du document pourrait vouloir dire que la
       fenêtre ne s'est jamais affichée, et non qu'elle a omis de prendre
       le focus. */
    await expect(page.locator('#taskModalOverlay')).toBeVisible({ timeout: 15_000 });
}

async function fermerEtNettoyer(page) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 10_000 });
    await deleteActiveProject(page);
}

test('ouvrir la fenêtre de tâche donne le focus à son premier champ', async ({ page }) => {
    await ouvrirFenetreDeTache(page, `E2E FocusInitial ${Date.now()}`);

    /* --- L'ASSERTION CENTRALE ---
       openCreate() se termine par `this._taskName.focus()`. C'est
       l'application qui désigne ce champ, pas moi : le test ne fait que
       lui demander de tenir sa propre parole. */
    await expect(page.locator('#taskName')).toBeFocused({ timeout: 10_000 });

    await fermerEtNettoyer(page);
});

test('une tabulation dans la fenêtre de tâche n\'en sort pas', async ({ page }) => {
    await ouvrirFenetreDeTache(page, `E2E FocusPiege ${Date.now()}`);

    await page.keyboard.press('Tab');

    /* --- L'ASSERTION CENTRALE ---
       Ce test mesure la CONSÉQUENCE là où le précédent mesure la CAUSE.
       Il ne nomme aucun élément d'arrivée : peu importe où Tab conduit,
       pourvu que ce soit à l'intérieur de la fenêtre. Exiger un contrôle
       précis reviendrait à verrouiller l'ordre du formulaire, qui n'est
       pas en cause et peut légitimement changer.

       Le focus part de <body> tant que le défaut tient : Tab gagne alors
       le premier élément focalisable du document, qui est dans l'en-tête,
       derrière le voile. */
    const dansLaFenetre = await page.evaluate(
        () => !!document.activeElement && !!document.activeElement.closest('#taskModalOverlay'));
    expect(dansLaFenetre).toBe(true);

    await fermerEtNettoyer(page);
});
