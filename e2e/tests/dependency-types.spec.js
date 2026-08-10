import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Types de lien et décalage (TEST_PLAN.md § B7, au-delà du cas par défaut).
 *
 * task-dependencies.spec.js ne couvre que Fin→Début avec un décalage nul —
 * son propre commentaire le dit. Restent SS, FF, SF et le décalage, tous
 * exposés dans la modal (un <select> et un champ numérique par
 * prédécesseur) et tous non vérifiés.
 *
 * L'enjeu principal est une ASYMÉTRIE D'UNITÉS assumée par le moteur :
 *
 *   « DECALAGE (lag) : compte en jours CALENDAIRES, car le besoin reel
 *     est un delai d'instruction de permis ou un temps de sechage »
 *     — store.js, _computeConstrainedDates
 *
 * Tout le reste du moteur compte en jours OUVRÉS. Deux unités dans la même
 * fonction, l'une justifiée par le métier : c'est exactement la
 * configuration qui a produit le défaut du champ « durée », écrit en
 * ouvrés et relu en calendaires. Rien ne gardait cette frontière.
 *
 * Chaque cas est bâti pour qu'une implémentation erronée donne une date
 * DIFFÉRENTE, jamais la même par chance. Toutes les dates ont été
 * calculées en exécutant les fonctions du dépôt, et juin 2026 ne contient
 * aucun jour férié — la seule variable est le type de lien.
 */

/** Crée une tâche aux dates données. Toutes tombent un jour ouvré de
 *  juin 2026, aucune n'est donc recalée à la création. */
async function creerTache(page, { nom, debut, fin }) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
}

/** Lie `successeur` à `predecesseur` avec un type et un décalage.
 *
 *  Le <select> et le champ de décalage ne sont révélés que par la case
 *  cochée (majVisibilite dans task-modal.js) : l'ordre compte. */
async function lier(page, { successeur, predecesseur, type, decalage = 0 }) {
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: successeur });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    await barre.dblclick();

    const groupe = page.locator('.form-group', { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const ligne = groupe.locator('.dep-list > div').filter({ hasText: predecesseur });
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption(type);
    if (decalage !== 0) {
        await ligne.locator('input[type="number"]').fill(String(decalage));
    }

    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
    return barre;
}

/** Rouvre une tâche et vérifie ses dates, puis referme sans enregistrer. */
async function verifierDates(page, barre, { debut, fin }) {
    await barre.dblclick();
    await expect(page.locator('#taskStart')).toHaveValue(debut);
    await expect(page.locator('#taskEnd')).toHaveValue(fin);
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();
}

/* B part toujours d'ici : lundi 1er → mercredi 3 juin 2026, soit 3 jours
   ouvrés, et une semaine AVANT tout ce qui suit. Une date attendue ne peut
   donc pas coïncider avec la position de départ. */
const B_DEBUT = '2026-06-01';
const B_FIN   = '2026-06-03';

test('Fin→Début : le décalage se compte en jours calendaires, pas ouvrés', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E DepFS ${suffixe}`;
    const nomA = `Amont FS ${suffixe}`;
    const nomB = `Aval FS ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    // A finit le VENDREDI 5 juin : le décalage enjambe donc un week-end.
    await creerTache(page, { nom: nomA, debut: '2026-06-03', fin: '2026-06-05' });
    await creerTache(page, { nom: nomB, debut: B_DEBUT, fin: B_FIN });

    const barreB = await lier(page, { successeur: nomB, predecesseur: nomA, type: 'FS', decalage: 5 });

    /* Fin de A + 1 + 5 jours CALENDAIRES = jeudi 11 juin, qui est ouvré
       et n'est donc pas repoussé. B conserve ses 3 jours ouvrés :
       jeu 11 → lun 15 (le week-end du 13-14 est sauté, LUI, en ouvrés).
       Si le décalage était compté en jours ouvrés, B commencerait le
       lundi 15 — quatre jours plus tard. C'est cet écart que le test
       verrouille, et avec lui la coexistence des deux unités. */
    await verifierDates(page, barreB, { debut: '2026-06-11', fin: '2026-06-15' });

    await deleteActiveProject(page);
});

test('Début→Début : les deux tâches démarrent le même jour', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E DepSS ${suffixe}`;
    const nomA = `Amont SS ${suffixe}`;
    const nomB = `Aval SS ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await creerTache(page, { nom: nomA, debut: '2026-06-08', fin: '2026-06-12' });
    await creerTache(page, { nom: nomB, debut: B_DEBUT, fin: B_FIN });

    const barreB = await lier(page, { successeur: nomB, predecesseur: nomA, type: 'SS' });

    /* SS aligne les DÉBUTS : B démarre le lundi 8 juin, comme A, et garde
       ses 3 jours ouvrés. En Fin→Début, B attendrait la fin de A et ne
       démarrerait pas avant le lundi 15 : les deux types ne peuvent pas
       être confondus par ce scénario. */
    await verifierDates(page, barreB, { debut: '2026-06-08', fin: '2026-06-10' });

    await deleteActiveProject(page);
});

test('Fin→Fin : la fin est épinglée et le début recule d’autant', async ({ page }) => {
    const suffixe = Date.now();
    const projectName = `E2E DepFF ${suffixe}`;
    const nomA = `Amont FF ${suffixe}`;
    const nomB = `Aval FF ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await creerTache(page, { nom: nomA, debut: '2026-06-09', fin: '2026-06-11' });
    await creerTache(page, { nom: nomB, debut: B_DEBUT, fin: B_FIN });

    const barreB = await lier(page, { successeur: nomB, predecesseur: nomA, type: 'FF' });

    /* FF est le seul cas où la contrainte porte sur la FIN : B finit le
       jeudi 11 juin comme A, et son début est calculé À REBOURS depuis
       cette fin — mar 9, en retirant 2 jours ouvrés. Aucun type piloté par
       le début ne produirait ce recul. */
    await verifierDates(page, barreB, { debut: '2026-06-09', fin: '2026-06-11' });

    await deleteActiveProject(page);
});
