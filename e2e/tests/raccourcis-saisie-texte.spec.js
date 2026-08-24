import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourcis clavier) sous l'angle que
 * undo-redo.spec.js et search.spec.js laissent de côté : ce que les
 * raccourcis font quand le curseur est DANS un champ de texte.
 *
 * LE DÉFAUT : Ctrl+Z, Ctrl+Y et Ctrl+A sont captés par l'application même
 * pendant une saisie, et le sens natif de ces touches est supprimé.
 *
 *     const _prevent = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
 *     window.addEventListener('keydown', async (e) => {
 *         if (mod && !e.shiftKey && e.key === 'z') {
 *             _prevent(e);
 *             if (await store.undo()) { … }
 *
 * Aucune garde sur l'élément qui a le focus. Un utilisateur qui se trompe
 * en tapant un nom et fait Ctrl+Z par réflexe n'annule pas sa frappe : il
 * annule la dernière action de l'application. Sa tâche précédente
 * disparaît, ou une tâche supprimée revient. Le preventDefault() achève le
 * tableau en supprimant l'annulation native, si bien qu'aucun des deux
 * comportements attendus ne se produit — ni celui du navigateur, ni rien
 * d'inoffensif.
 *
 * L'APPLICATION CONNAÎT POURTANT LA GARDE. Deux branches du même
 * gestionnaire, quinze lignes plus bas, la posent :
 *
 *     if ((e.key === 'Delete' || e.key === 'Backspace') && …) {
 *         const activeEl = document.activeElement;
 *         const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
 *         if (!isInput) { … }
 *
 * Suppr et les touches 1/2/3 sont protégées ; Ctrl+Z, Ctrl+Y et Ctrl+A ne
 * le sont pas. Même forme qu'en #46 et #53 : l'invariant est écrit à un
 * endroit et violé à côté.
 *
 * ET LA PROTECTION TENTÉE AILLEURS EST INOPÉRANTE. Le champ de recherche
 * de projets essaie de se mettre à l'abri des raccourcis globaux :
 *
 *     searchInput.addEventListener('keydown', e => e.stopPropagation());
 *
 * Sans effet : le gestionnaire global est posé en phase de CAPTURE, donc il
 * s'exécute AVANT celui du champ. L'intention est là, la protection n'y est
 * pas. C'est dans le gestionnaire global que la garde doit se trouver.
 */

/** Crée une tâche via la modal et attend que sa barre soit rendue. */
async function creerTache(page, nom) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill('2026-09-07');
    await page.locator('#taskEnd').fill('2026-09-09');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

/* Les deux tests partagent le même préfixe de nom pour que la recherche
   « Lot 3 » laisse toutes les tâches visibles : le filtre ne doit pas
   masquer ce que les assertions vont chercher. */
const PREFIXE = 'Lot 3';

test('Ctrl+Z et Ctrl+Y pendant une saisie n\'agissent pas sur l\'historique', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E RaccourcisUndo ${suffixe}`;
    const nomA      = `${PREFIXE} Sondage ${suffixe}`;
    const nomB      = `${PREFIXE} Terrassement ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    const barreA = await creerTache(page, nomA);
    const barreB = await creerTache(page, nomB);

    /* Sert UNIQUEMENT au discriminant : voir plus bas pourquoi le toast ne
       peut pas servir à mesurer une absence. */
    const toastAnnule = page.locator('#toastContainer .toast', { hasText: 'Action annulée' });

    /* DISCRIMINANT — HORS D'UN CHAMP, LE RACCOURCI FONCTIONNE. Le focus est
       remis au document, puis Ctrl+Z annule la création de B. Cela établit
       trois choses d'un coup : le raccourci est bien branché, la frappe de
       Playwright l'atteint, et l'annulation se voit à l'écran. Sans ce
       préalable, un « rien ne s'est passé » plus bas pourrait simplement
       vouloir dire que la touche n'est jamais arrivée. */
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await expect(toastAnnule).toBeVisible({ timeout: 10_000 });
    await expect(barreB).toHaveCount(0);
    await expect(barreA).toBeVisible();

    /* La pile d'annulation contient maintenant, au sommet, la création de
       A ; la pile de rétablissement contient celle de B. Un Ctrl+Z parasite
       ferait donc disparaître A, et un Ctrl+Y parasite ferait revenir B :
       les deux se voient. */
    await page.keyboard.press('Control+f');
    const champ = page.locator('#searchInput');
    await expect(champ).toBeFocused();

    /* pressSequentially, et non fill : il faut de vrais événements clavier
       pour que le navigateur constitue un historique d'édition — c'est cet
       historique que Ctrl+Z doit servir. Le texte saisi correspond à A, que
       le filtre laisse donc visible. */
    await champ.pressSequentially(PREFIXE, { delay: 30 });
    await expect(barreA).toBeVisible({ timeout: 10_000 });

    /* --- PREMIÈRE ASSERTION CENTRALE : Ctrl+Z ---
       Une attente fixe est ici le bon outil, et le seul : l'assertion porte
       sur une ABSENCE d'effet, et une absence ne s'observe qu'après avoir
       laissé à l'effet le temps de se produire. Le discriminant vient de
       montrer que l'annulation se manifeste en moins d'une seconde, écriture
       en base comprise ; 3 s laisse une marge confortable.

       PAS D'ASSERTION SUR LE TOAST ICI. Un `expect(toast).toHaveCount(0)`
       serait décoratif : c'est une assertion à réessai, et le toast s'efface
       de lui-même au bout de 3,3 s, si bien qu'elle finirait toujours par
       passer — défaut ou pas. La barre de A, elle, ne revient jamais. */
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(3000);
    await expect(barreA).toBeVisible();

    /* --- SECONDE ASSERTION CENTRALE : Ctrl+Y ---
       Distincte de la première : Ctrl+Y est une branche séparée du même
       gestionnaire, et rétablir n'est pas annuler. B ne doit pas revenir. */
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(3000);
    await expect(barreB).toHaveCount(0);

    await deleteActiveProject(page);
});

test('Ctrl+A dans un champ de texte sélectionne le texte, pas toutes les tâches', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E RaccourcisSelect ${suffixe}`;
    const nomA      = `${PREFIXE} Étaiement ${suffixe}`;
    const nomB      = `${PREFIXE} Ferraillage ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    await creerTache(page, nomA);
    await creerTache(page, nomB);

    /* Ctrl+A ne sélectionne les tâches que dans la vue Tableau : c'est la
       condition posée par le code (this._activeView === 'board'). */
    await page.locator('#tabBoard').click();
    await expect(page.locator('.table-task-name')).toHaveCount(2, { timeout: 10_000 });

    const barreLot = page.locator('#batchActionBar');

    /* DISCRIMINANT — HORS D'UN CHAMP, LE RACCOURCI FONCTIONNE. La barre
       d'actions groupées n'existe dans le DOM que si au moins une tâche est
       sélectionnée : sa présence est un témoin sans ambiguïté. */
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+a');
    await expect(barreLot).toBeVisible({ timeout: 10_000 });
    await expect(barreLot).toContainText('2 tâches sélectionnées');

    /* Échap efface la sélection : on repart d'un état propre, et on vérifie
       que le témoin sait aussi disparaître. */
    await page.keyboard.press('Escape');
    await expect(barreLot).toHaveCount(0, { timeout: 10_000 });

    await page.keyboard.press('Control+f');
    const champ = page.locator('#searchInput');
    await expect(champ).toBeFocused();
    await champ.pressSequentially(PREFIXE, { delay: 30 });
    await expect(champ).toHaveValue(PREFIXE);

    await page.keyboard.press('Control+a');

    /* --- PREMIÈRE ASSERTION CENTRALE : LE TEXTE EST SÉLECTIONNÉ ---
       Affirmation POSITIVE, donc sans fenêtre d'attente : la sélection
       native est synchrone. preventDefault() la supprime, et le champ reste
       avec un simple curseur en fin de texte. */
    const selection = await champ.evaluate(
        (el) => ({ debut: el.selectionStart, fin: el.selectionEnd }));
    expect(selection).toEqual({ debut: 0, fin: PREFIXE.length });

    /* --- SECONDE ASSERTION CENTRALE : AUCUNE TÂCHE SÉLECTIONNÉE ---
       L'autre moitié du défaut. _selectAllTasks() est synchrone, donc la
       barre d'actions groupées serait déjà là si le raccourci avait été
       détourné. */
    await expect(barreLot).toHaveCount(0);

    await deleteActiveProject(page);
});
