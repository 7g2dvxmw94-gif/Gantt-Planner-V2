import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), quatrième angle après
 * critical-path.spec.js (liens Fin→Début simples),
 * chemin-critique-liens.spec.js (types et décalages) et
 * chemin-critique-ancrage.spec.js (tâches sans prédécesseur) : le
 * week-end.
 *
 * LE DÉFAUT : getCriticalPath() compte en jours CALENDAIRES ce que le
 * moteur planifie en jours OUVRÉS.
 *
 *     duration[t.id] = daysBetween(t.startDate, t.endDate) + 1;
 *     ancre[t.id]    = daysBetween(projectStart, t.startDate);
 *     …
 *     const c = ef[predId] + lag;        // FS : le lendemain CALENDAIRE
 *
 * Quand _computeConstrainedDates(), lui, ne connaît que les jours ouvrés :
 *
 *     const span = workingDaysBetween(task.startDate, task.endDate, cal);
 *     const c    = nextWorkingDay(decalerCalendaire(pred.endDate, 1 + lag), cal);
 *     newEnd     = addWorkingDays(latestStart, span - 1, cal);
 *
 * TROISIÈME FACE DE LA MÊME DIVERGENCE, après les types de liens (#56) et
 * l'ancrage des racines (#57) : le planificateur et le calcul de marge
 * disent deux choses différentes du même projet.
 *
 * DEUX ERREURS S'AJOUTENT, ET ELLES VONT DANS LE MÊME SENS :
 *
 *   1. une tâche qui ENJAMBE un week-end paraît plus longue qu'elle n'est
 *      — cinq jours calendaires pour trois jours ouvrés ;
 *   2. un successeur en Fin→Début est placé le LENDEMAIN CALENDAIRE de son
 *      prédécesseur, samedi compris, au lieu du jour ouvré suivant.
 *
 * La première gonfle les tâches parallèles, la seconde tasse les chaînes.
 * Le calcul finit par désigner la mauvaise.
 *
 * LE VERDICT EST INVERSÉ, PAS SEULEMENT IMPRÉCIS. Mesuré hors navigateur
 * sur le texte réel de la fonction, ce projet-ci donne `['C']` — la seule
 * tâche qui ait de la marge — et prête de la marge à A et B, qui portent
 * la fin du projet.
 *
 * LE VERDICT ATTENDU EST OBJECTIF. Travaux finit le mardi 9, en même temps
 * que le projet, et rien ne la suit : la retarder d'un jour retarde le
 * projet. Voirie finit le lundi 8, un jour ouvré plus tôt, et rien ne la
 * suit non plus : elle peut glisser d'un jour sans rien déplacer. Aucune
 * appréciation là-dedans.
 *
 * JUIN 2026 COMMENCE UN LUNDI. Le 4 est un jeudi, le 5 un vendredi, les 6
 * et 7 le week-end, le 8 un lundi, le 9 un mardi. Tout le fichier s'appuie
 * sur ce calendrier.
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

/** Le <select> de type n'est révélé que par la case cochée : l'ordre compte. */
async function lier(page, barreSuccesseur, nomPredecesseur, type) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const ligne = groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption(type);
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

const CRITIQUE = /critical-path/;

test('le chemin critique compte les durées en jours ouvrés, pas calendaires', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E CPOuvres ${suffixe}`;
    const nomEtude  = `Etude ${suffixe}`;       // jeu 4 → ven 5
    const nomTravaux = `Travaux ${suffixe}`;    // lun 8 → mar 9, après Etude
    const nomVoirie = `Voirie ${suffixe}`;      // jeu 4 → lun 8, enjambe le week-end

    await page.goto('index.html');
    await createProject(page, nomProjet);

    const barreEtude  = await creerTache(page, nomEtude,  '2026-06-04', '2026-06-05');
    const barreVoirie = await creerTache(page, nomVoirie, '2026-06-04', '2026-06-08');
    /* Travaux naît une semaine plus loin, sur deux jours ouvrés pleins :
       c'est le lien qui la ramènera, et sa durée ouvrée est ainsi posée
       sans ambiguïté (lundi → mardi = 2 jours ouvrés). */
    const barreTravaux = await creerTache(page, nomTravaux, '2026-06-15', '2026-06-16');

    await lier(page, barreTravaux, nomEtude, 'FS');

    /* PREMIER DISCRIMINANT — LE MOTEUR SAUTE BIEN LE WEEK-END.
       Fin d'Etude le vendredi 5, +1 jour calendaire = samedi 6, reporté au
       lundi 8 ouvré ; Travaux y tient ses deux jours ouvrés, lundi 8 →
       mardi 9. C'est cette date qui fait la fin du projet, et c'est aussi
       la prémisse de tout ce qui suit : sans elle, les assertions
       porteraient sur un planning que je n'aurais pas établi. */
    await verifierDates(page, barreTravaux, '2026-06-08', '2026-06-09');

    await page.locator('#criticalPathBtn').click();

    /* SECOND DISCRIMINANT — LE CALCUL A TOURNÉ.
       Aucune tâche n'est critique dans les DEUX lectures ici : la juste
       désigne Etude et Travaux, la fausse désigne Voirie. Aucune barre ne
       peut donc servir de témoin, et c'est le décompte qui joue ce rôle —
       sans préjuger du nombre, que les assertions centrales tranchent. */
    await expect(page.locator('#toastContainer .toast',
        { hasText: /Chemin critique : \d+ tâches? sur 3/ })).toBeVisible({ timeout: 10_000 });

    /* --- PREMIÈRE ASSERTION CENTRALE ---
       Travaux finit le mardi 9, en même temps que le projet, et rien ne la
       suit : la retarder d'un jour retarde le projet. Marge nulle, donc
       critique. Le calcul la croit pourtant en retrait, parce qu'il la
       place le samedi et l'y fait finir le dimanche. */
    await expect(barreTravaux).toHaveClass(CRITIQUE);

    /* --- SECONDE ASSERTION CENTRALE ---
       L'autre moitié de la même erreur. Voirie finit le lundi 8, un jour
       ouvré avant la fin du projet, et rien ne la suit : elle a de la
       marge. Le calcul la croit sans marge, parce qu'il compte cinq jours
       là où elle n'en occupe que trois. */
    await expect(barreVoirie).not.toHaveClass(CRITIQUE);

    /* Etude porte la chaîne qui fait la fin du projet : elle est critique
       avec Travaux. L'exiger ferme la description du verdict attendu. */
    await expect(barreEtude).toHaveClass(CRITIQUE);

    await deleteActiveProject(page);
});
