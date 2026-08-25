import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle que
 * critical-path.spec.js laisse de côté : ses deux scénarios n'emploient que
 * des liens Fin→Début sans décalage. C'est précisément le seul cas où le
 * calcul tombe juste.
 *
 * LE DÉFAUT : getCriticalPath() traite TOUT lien comme un Fin→Début de
 * décalage nul.
 *
 *     tasks.forEach(t => {
 *         (t.dependencies || []).forEach(dep => {
 *             const predId = dep.taskId;          // dep.type ignoré
 *             …                                   // dep.lag  ignoré
 *     …
 *     es[id] = Math.max(...predecessorsOf[id].map(pid => ef[pid]));
 *
 * `dep.type` et `dep.lag` ne sont lus nulle part. Or l'application les
 * implémente bel et bien ailleurs — _computeConstrainedDates() distingue
 * FS, SS, FF et SF et applique le décalage, et dependency-types.spec.js
 * verrouille les trois premiers. Le planificateur et le calcul de marge
 * disent donc deux choses différentes du même projet.
 *
 * LES DEUX MOITIÉS DU DÉFAUT SONT MESURÉES SÉPARÉMENT, une par test :
 * le TYPE ignoré (Début→Début), puis le DÉCALAGE ignoré (Fin→Début + 5 j).
 *
 * DANS LES DEUX CAS, LE VERDICT EST OBJECTIF, pas affaire d'appréciation :
 * une tâche qui finit en même temps que le projet et que rien ne suit n'a
 * aucune marge — la retarder d'un jour retarde le projet ; une tâche qui
 * finit plusieurs jours avant la fin du projet et que rien ne suit en a
 * forcément.
 *
 * AUCUN WEEK-END À L'INTÉRIEUR D'UNE TÂCHE. getCriticalPath() compte les
 * durées en jours CALENDAIRES là où le moteur planifie en jours ouvrés —
 * limite connue, déjà signalée par critical-path.spec.js, et qui n'est PAS
 * l'objet de ces tests. Les dates sont donc choisies pour que les deux
 * unités coïncident, afin qu'un écart ne puisse venir que des liens.
 * (Le décalage du second test, lui, enjambe volontairement un week-end :
 * il se compte en jours calendaires des deux côtés.)
 */

/** Juin 2026 commence un lundi : 1-5, 8-12 et 15-19 sont des semaines
 *  ouvrées pleines. Toutes les dates du fichier s'y appuient. */
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

/** Le <select> de type et le champ de décalage ne sont révélés que par la
 *  case cochée (majVisibilite dans task-modal.js) : l'ordre compte. */
async function lier(page, barreSuccesseur, nomPredecesseur, type, decalage = 0) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const ligne = groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption(type);
    if (decalage !== 0) await ligne.locator('input[type="number"]').fill(String(decalage));
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
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

const CRITIQUE = /critical-path/;

test('un lien Début→Début ne rend pas critique la tâche qui finit la première', async ({ page }) => {
    const suffixe    = Date.now();
    const nomProjet  = `E2E CPTypes ${suffixe}`;
    const nomLongue  = `Gros oeuvre ${suffixe}`;
    const nomBreve   = `Installation chantier ${suffixe}`;
    const nomParall  = `Voirie ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    /* Longue et Parallèle occupent la même semaine pleine et finissent
       ensemble le vendredi : ce sont elles qui portent la fin du projet. */
    const barreLongue = await creerTache(page, nomLongue, '2026-06-01', '2026-06-05');
    const barreParall = await creerTache(page, nomParall, '2026-06-01', '2026-06-05');
    /* Brève naît DEUX SEMAINES PLUS LOIN pour que son déplacement par le
       lien soit visible et non un hasard de position initiale. */
    const barreBreve  = await creerTache(page, nomBreve,  '2026-06-15', '2026-06-16');

    await lier(page, barreBreve, nomLongue, 'SS');

    /* PREMIER DISCRIMINANT — LE LIEN A BIEN AGI SUR LE PLANNING. Brève
       démarre désormais le même jour que Longue et finit le mardi, trois
       jours avant la fin du projet. Sans cette vérification, tout ce qui
       suit porterait sur un planning que je n'aurais pas établi. */
    await verifierDates(page, barreBreve, '2026-06-01', '2026-06-02');

    await page.locator('#criticalPathBtn').click();

    /* SECOND DISCRIMINANT — LE SURLIGNAGE FONCTIONNE. Longue est critique
       dans les deux lectures, la juste comme la fausse : l'exiger d'abord
       établit que le calcul a tourné et que la classe est bien posée, sans
       rien préjuger du défaut. C'est aussi le point de synchronisation des
       assertions négatives qui suivent. */
    await expect(barreLongue).toHaveClass(CRITIQUE, { timeout: 10_000 });

    /* --- PREMIÈRE ASSERTION CENTRALE ---
       Parallèle finit le vendredi, en même temps que le projet, et rien ne
       la suit : la retarder d'un jour retarde le projet. Marge nulle, donc
       critique. Le calcul la croit pourtant en retrait, parce qu'il place
       Brève APRÈS Longue au lieu d'EN MÊME TEMPS et allonge ainsi le projet
       de deux jours imaginaires. */
    await expect(barreParall).toHaveClass(CRITIQUE);

    /* --- SECONDE ASSERTION CENTRALE ---
       L'autre moitié de la même erreur : Brève finit le mardi, trois jours
       avant la fin du projet, et rien ne la suit. Elle a trois jours de
       marge et ne peut pas être critique. */
    await expect(barreBreve).not.toHaveClass(CRITIQUE);

    await deleteActiveProject(page);
});

test('un décalage sur un lien Fin→Début compte dans le calcul de marge', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E CPDecalage ${suffixe}`;
    const nomAmont  = `Dépôt du permis ${suffixe}`;
    const nomAval   = `Ouverture chantier ${suffixe}`;
    const nomParall = `Sondage de sol ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    const barreAmont  = await creerTache(page, nomAmont,  '2026-06-01', '2026-06-03');
    const barreParall = await creerTache(page, nomParall, '2026-06-01', '2026-06-05');
    const barreAval   = await creerTache(page, nomAval,   '2026-06-15', '2026-06-16');

    /* Cinq jours calendaires de délai — le cas d'usage même de l'option :
       instruction d'un permis, séchage, livraison. */
    await lier(page, barreAval, nomAmont, 'FS', 5);

    /* PREMIER DISCRIMINANT — LE DÉCALAGE A BIEN AGI SUR LE PLANNING.
       Fin d'Amont (mercredi 3) + 1 + 5 jours calendaires = mardi 9, qui est
       ouvré ; Aval y tient ses deux jours ouvrés, mardi 9 → mercredi 10.
       C'est cette date qui fait la fin du projet. */
    await verifierDates(page, barreAval, '2026-06-09', '2026-06-10');

    await page.locator('#criticalPathBtn').click();

    /* SECOND DISCRIMINANT — LE SURLIGNAGE FONCTIONNE. Amont est critique
       dans les deux lectures. */
    await expect(barreAmont).toHaveClass(CRITIQUE, { timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Parallèle finit le vendredi 5, cinq jours ouvrés avant la fin du
       projet, et rien ne la suit : elle a cinq jours de marge. En ignorant
       le décalage, le calcul croit qu'Aval enchaîne aussitôt après Amont et
       que le projet s'arrête le vendredi 5 lui aussi — d'où trois tâches
       critiques sur trois, et une marge de cinq jours escamotée. */
    await expect(barreParall).not.toHaveClass(CRITIQUE);

    /* Le décompte le dit aussi, et c'est ici qu'il discrimine : deux tâches
       critiques sur trois, non pas trois. */
    await expect(page.locator('#toastContainer .toast',
        { hasText: 'Chemin critique : 2 tâches sur 3' })).toBeVisible();

    await deleteActiveProject(page);
});
