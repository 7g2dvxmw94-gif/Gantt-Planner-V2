import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (permis) : une péremption partie d'un
 * 29 février expire le DERNIER JOUR DE FÉVRIER, pas le 1er mars.
 *
 * LE TEXTE. Article 641 du code de procédure civile, deuxième alinéa :
 *
 *     « Lorsqu'un délai est exprimé en mois ou en années, ce délai expire
 *       le jour du dernier mois ou de la dernière année qui porte le même
 *       quantième que le jour de l'acte, de l'événement, de la décision ou
 *       de la notification qui fait courir le délai. À DÉFAUT D'UN
 *       QUANTIÈME IDENTIQUE, LE DÉLAI EXPIRE LE DERNIER JOUR DU MOIS. »
 *
 * LE CODE. addYears() s'appuie sur setFullYear(), et JavaScript reporte
 * alors au mois suivant :
 *
 *     addYears('2028-02-29', 3)  ->  2031-03-01   (JavaScript)
 *                                    2031-02-28   (article 641)
 *
 * CE DÉFAUT ÉTAIT DÉJÀ ÉCRIT DANS utils.js, en toutes lettres, au-dessus
 * de la fonction : « LIMITE CONNUE, NON TRAITEE ICI […] c'est une regle
 * juridique que je n'ai pas verifiee contre une source, et aucun rouge ne
 * la couvre. Signalee plutot qu'implementee au juge. » Les deux
 * conditions ont changé : le texte a été vérifié sur Légifrance, et ce
 * fichier est le rouge qui manquait.
 *
 * DEUX IMPLÉMENTATIONS DE LA MÊME RÈGLE QUI DIVERGENT. addMonths(), juste
 * en dessous dans le même fichier, applique DÉJÀ le calage correct —
 * addMonths('2028-02-29', 36) rend 2031-02-28. C'est la forme de défaut
 * qui a produit #56, #57 et #66 : une règle écrite deux fois, et les deux
 * écritures qui ne disent pas la même chose.
 *
 * PORTÉE RÉELLE. addYears ne sert qu'à la péremption des permis
 * (PERMIT_VALIDITY_YEARS = 3, R*424-17). Le défaut ne se manifeste donc
 * que pour une décision prise un 29 février — une année sur quatre, et
 * seulement ce jour-là. C'est rare, mais ce n'est pas anodin : la date
 * annoncée décide si des travaux non engagés font tomber le permis.
 *
 * LE MONTAGE MET DEUX JOURS CONSÉCUTIFS EN REGARD. 2031 n'ayant pas de
 * 29 février, une décision du 28 et une décision du 29 février 2028
 * doivent toutes deux expirer le 28 février 2031. Le code les sépare :
 *
 *     décision 2028-02-28   ->  2031-02-28   (juste, avant comme après)
 *     décision 2028-02-29   ->  2031-03-01   au lieu de 2031-02-28
 *
 * 2028 EST LA PREMIÈRE ANNÉE BISSEXTILE À VENIR, ce qui garde le cas
 * plausible plutôt que théorique.
 */

/* Le 28 février 2028, un lundi. Son quantième existe en 2031 : le code
   tombe juste, et cette attente passe avant comme après le correctif. */
const DECISION_VEILLE = '2028-02-28';
const PEREMPTION_VEILLE = '2031-02-28';

/* Le 29 février 2028, un mardi. Son quantième n'existe pas en 2031. */
const DECISION_BISSEXTILE = '2028-02-29';
const PEREMPTION_BISSEXTILE = '2031-02-28';   // art. 641 : dernier jour du mois

async function dateAffichee(page, iso) {
    return page.evaluate((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const locale = { fr: 'fr-FR', en: 'en-US' }[localStorage.getItem('gantt_lang')] || 'fr-FR';
        return new Date(y, m - 1, day).toLocaleDateString(locale, {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    }, iso);
}

function valeurEcheance(page, libelle) {
    return page.locator('.permit-deadline-item')
        .filter({ has: page.locator('.permit-deadline-label', { hasText: libelle }) })
        .locator('.permit-deadline-value');
}

function champDecision(page) {
    return page.locator('.permit-fields .form-group')
        .filter({ hasText: 'Date de décision' })
        .locator('input[type="date"]');
}

test('une péremption partie d\'un 29 février expire le dernier jour de février', async ({ page }) => {
    const suffixe = Date.now();

    await page.goto('index.html');
    await createProject(page, `E2E PeremptionQuantieme ${suffixe}`);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(`PC Atelier ${suffixe}`);
    await page.locator('#taskStart').fill('2028-02-01');
    await page.locator('#taskEnd').fill('2028-06-30');

    /* PREMIER DISCRIMINANT — LE PERMIS EST ACCORDÉ.
       calculatePermitDeadlines ne calcule la péremption que si le statut
       vaut « granted » ou « granted_conditions ». Sur un autre statut,
       l'échéance n'existerait pas et son absence ne dirait rien de son
       arithmétique. */
    await page.locator('#permitStatus').selectOption('granted');
    await expect(page.locator('#permitStatus')).toHaveValue('granted');

    const peremption = valeurEcheance(page, 'Péremption permis');

    /* SECOND DISCRIMINANT — LA VEILLE TOMBE JUSTE.
       Le 28 février 2028 a un quantième qui existe en 2031 : le report de
       JavaScript et l'article 641 s'accordent. L'exiger établit que la
       date de décision a été prise en compte, que la péremption est
       calculée, affichée et lue au bon endroit — de sorte qu'un écart sur
       le jour suivant ne pourra venir que de l'arithmétique du quantième
       manquant. Cette attente passe avant comme après le correctif. */
    await champDecision(page).fill(DECISION_VEILLE);
    await expect(peremption).toHaveText(
        await dateAffichee(page, PEREMPTION_VEILLE), { timeout: 10_000 });

    await champDecision(page).fill(DECISION_BISSEXTILE);

    /* TROISIÈME DISCRIMINANT — LE 29 FÉVRIER A ÉTÉ ACCEPTÉ TEL QUEL.
       Un champ de type `date` peut normaliser une date qu'il juge
       invalide. Si le navigateur avait ramené le 29 au 1er mars, tout ce
       qui suit porterait sur une autre décision que celle annoncée, et le
       test mesurerait autre chose que ce qu'il prétend. */
    await expect(champDecision(page)).toHaveValue(DECISION_BISSEXTILE);

    /* --- L'ASSERTION CENTRALE ---
       2031 n'a pas de 29 février. L'article 641 fait donc expirer le délai
       le dernier jour du mois, soit le 28 — le même jour que pour une
       décision de la veille. setFullYear() reporte au 1er mars, et le
       permis paraît valide un jour de trop. */
    await expect(peremption).toHaveText(
        await dateAffichee(page, PEREMPTION_BISSEXTILE), { timeout: 10_000 });

    await page.locator('#taskModalOverlay').locator('button', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    await deleteActiveProject(page);
});
