import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4, volet des délais réglementaires — complément
 * de permit.spec.js, qui vérifie l'instruction et la complétude mais pas
 * la péremption.
 *
 * LE DÉFAUT : la validité d'un permis est comptée en 1095 jours, pas en
 * trois ans.
 *
 *     const PERMIT_VALIDITY_YEARS = 3;
 *     …
 *     deadlines.expiryDate = formatDateISO(addDays(decision, PERMIT_VALIDITY_YEARS * 365));
 *
 * Trois ans ne font 1095 jours que si aucun 29 février ne tombe dans
 * l'intervalle. Dès qu'il y en a un — environ trois années sur quatre —,
 * la date affichée est en retard d'un jour sur la date réelle. Toujours
 * dans le même sens : le permis paraît périmé la veille de sa péremption.
 *
 * L'enjeu n'est pas cosmétique. Le délai de validité d'un permis de
 * construire commande l'ouverture du chantier ; une date fausse d'un jour
 * est une date fausse.
 *
 * permit.spec.js le dit déjà de la logique de permis en général :
 * « la seule dont une régression serait silencieuse : un délai faux reste
 * un délai plausible à l'écran ». C'est exactement le cas ici.
 *
 * LE DISCRIMINANT EST UNE SECONDE DATE. Une décision au 1er mars 2028 ne
 * rencontre aucun 29 février avant le 1er mars 2031 : le code y tombe
 * juste. Le test l'exige d'abord. Cela établit que la péremption est bien
 * calculée et affichée, et isole le défaut au seul cas bissextile — sans
 * quoi un écart pourrait signifier que la fonctionnalité est simplement
 * cassée, ou que je lis le mauvais champ.
 */

/* Décision sans 29 février dans les trois ans : le code est juste. */
const DECISION_SANS_BISSEXTILE = '2028-03-01';
const PEREMPTION_SANS_BISSEXTILE = '2031-03-01';

/* Décision avec le 29 février 2028 dans l'intervalle : le code compte
   1095 jours là où il en faut 1096, et affiche le 14 pour le 15. */
const DECISION_AVEC_BISSEXTILE = '2026-09-15';
const PEREMPTION_AVEC_BISSEXTILE = '2029-09-15';

/** Rend une date ISO comme l'app le fait (utils.js formatDateDisplay).
 *  Calculé DANS la page : le format dépend de la locale et de l'ICU du
 *  navigateur, qu'on ne veut pas réimplémenter — seul le calcul de
 *  l'échéance est l'objet du test, pas sa mise en forme. */
async function dateAffichee(page, iso) {
    return page.evaluate((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const locale = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }[localStorage.getItem('gantt_lang')] || 'fr-FR';
        return new Date(y, m - 1, day).toLocaleDateString(locale, {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    }, iso);
}

/** Valeur affichée d'une échéance, repérée par son libellé. */
function valeurEcheance(page, libelle) {
    return page.locator('.permit-deadline-item')
        .filter({ has: page.locator('.permit-deadline-label', { hasText: libelle }) })
        .locator('.permit-deadline-value');
}

/** Le champ « Date de décision » n'a pas d'id : on passe par son libellé. */
function champDecision(page) {
    return page.locator('.permit-fields .form-group')
        .filter({ hasText: 'Date de décision' })
        .locator('input[type="date"]');
}

test('la péremption d\'un permis se compte en années, pas en 1095 jours', async ({ page }) => {
    const suffixe   = Date.now();
    const nomProjet = `E2E Péremption ${suffixe}`;
    const nomPermis = `PC Bâtiment C ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // --- Un permis accordé : la péremption n'est calculée que dans ce cas ---
    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(nomPermis);
    await page.locator('#taskStart').fill('2026-08-10');
    await page.locator('#taskEnd').fill('2026-11-30');
    await page.locator('#permitStatus').selectOption('granted');

    const peremption = valeurEcheance(page, 'Péremption permis');

    /* DISCRIMINANT — sur une décision SANS 29 février dans les trois ans,
       le code tombe juste. Cela établit que la péremption est bien
       calculée, affichée, et lue au bon endroit : un écart plus bas ne
       pourra venir que de l'arithmétique bissextile. */
    await champDecision(page).fill(DECISION_SANS_BISSEXTILE);
    await expect(peremption).toHaveText(
        await dateAffichee(page, PEREMPTION_SANS_BISSEXTILE), { timeout: 10_000 });

    /* --- L'ASSERTION CENTRALE ---
       Le 29 février 2028 tombe dans l'intervalle. Trois ans après le
       15 septembre 2026, c'est le 15 septembre 2029 ; 1095 jours après,
       c'est le 14. */
    await champDecision(page).fill(DECISION_AVEC_BISSEXTILE);
    await expect(peremption).toHaveText(
        await dateAffichee(page, PEREMPTION_AVEC_BISSEXTILE), { timeout: 10_000 });

    await page.locator('#taskModalOverlay').locator('button', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden();

    await deleteActiveProject(page);
});
