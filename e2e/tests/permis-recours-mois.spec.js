import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (permis) : le délai de recours des tiers se
 * compte en MOIS, pas en soixante jours.
 *
 * LE TEXTE. Article R*600-2 du code de l'urbanisme :
 *
 *     « Le délai de recours contentieux à l'encontre d'une décision de
 *       non-opposition à une déclaration préalable ou d'un permis de
 *       construire, d'aménager ou de démolir court à l'égard des tiers à
 *       compter du premier jour d'une période continue de DEUX MOIS
 *       d'affichage sur le terrain des pièces mentionnées à l'article
 *       R. 424-15. »
 *
 * LE CODE. THIRD_PARTY_APPEAL_DAYS vaut 60, et calculatePermitDeadlines
 * applique addDays(displayStart, 60).
 *
 * TROISIÈME ARTICLE, MÊME FORME DE DÉFAUT. R*423-23 et R*423-24 ont été
 * traités par permis-instruction-mois ; celui-ci est le dernier délai du
 * module encore compté en tranches de trente jours.
 *
 * L'AMPLEUR : sur les 365 dates d'affichage de 2026, 364 donnent une fin
 * de recours fausse. Ce n'est pas un cas limite, c'est le cas général —
 * seul un intervalle contenant exactement soixante jours coïncide.
 *
 * ET CETTE DATE-LÀ N'EST PAS DÉCORATIVE. C'est celle à partir de laquelle
 * le permis est purgé de recours. L'annoncer deux jours trop tôt, c'est
 * dire à un maître d'ouvrage qu'il peut engager les travaux en sécurité
 * alors que la fenêtre de contestation est encore ouverte.
 *
 * LE 1er JUILLET 2026 EST CHOISI À DESSEIN : juillet et août comptant
 * trente et un jours, les deux lectures y divergent de DEUX jours.
 *
 *     affichage 2026-07-01    code 2026-08-30    loi 2026-09-01
 *
 * LE LIBELLÉ EST CHERCHÉ PAR EXPRESSION RÉGULIÈRE, et c'est nécessaire :
 * il vaut « Fin recours tiers (J-n) » tant que l'échéance est à venir et
 * « Recours purgé » une fois passée. Le figer reviendrait à faire dépendre
 * le test du jour où il tourne. La DATE attendue, elle, ne dépend que de
 * la date d'affichage saisie : elle reste juste en toute saison.
 */

const DECISION  = '2026-06-15';
const PEREMPTION = '2029-06-15';   // décision + 3 ans (R*424-17), déjà correct

const AFFICHAGE = '2026-07-01';
const FIN_RECOURS = '2026-09-01';  // affichage + 2 mois (R*600-2)

async function dateAffichee(page, iso) {
    return page.evaluate((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const locale = { fr: 'fr-FR', en: 'en-US' }[localStorage.getItem('gantt_lang')] || 'fr-FR';
        return new Date(y, m - 1, day).toLocaleDateString(locale, {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    }, iso);
}

/** Valeur d'une échéance, repérée par son libellé — chaîne ou expression
 *  régulière, selon que le libellé est stable dans le temps ou non. */
function valeurEcheance(page, libelle) {
    return page.locator('.permit-deadline-item')
        .filter({ has: page.locator('.permit-deadline-label', { hasText: libelle }) })
        .locator('.permit-deadline-value');
}

function champDate(page, libelle) {
    return page.locator('.permit-fields .form-group')
        .filter({ hasText: libelle })
        .locator('input[type="date"]');
}

test('la fin du recours des tiers se compte en mois, pas en soixante jours', async ({ page }) => {
    const suffixe = Date.now();

    await page.goto('index.html');
    await createProject(page, `E2E RecoursMois ${suffixe}`);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(`PC Entrepôt ${suffixe}`);
    await page.locator('#taskStart').fill('2026-06-01');
    await page.locator('#taskEnd').fill('2026-12-31');

    /* PREMIER DISCRIMINANT — LE PERMIS EST ACCORDÉ.
       calculatePermitDeadlines n'entre dans le bloc du recours que si le
       statut vaut « granted » ou « granted_conditions ». Sur un autre
       statut, appealEndDate n'existerait pas et l'assertion centrale
       échouerait pour une raison étrangère au défaut. */
    await page.locator('#permitStatus').selectOption('granted');
    await expect(page.locator('#permitStatus')).toHaveValue('granted');

    await champDate(page, 'Date de décision').fill(DECISION);
    await champDate(page, "Date début d'affichage").fill(AFFICHAGE);

    /* SECOND DISCRIMINANT — LA PÉREMPTION EST JUSTE.
       Elle sort du MÊME BLOC que le recours, conditionné par la même date
       de décision et le même statut. L'exiger établit d'un coup que la
       décision a été prise en compte, que le bloc a tourné, et que le
       panneau est rendu — de sorte qu'un échec plus bas ne pourra venir
       que de l'unité employée pour le recours. Trois ans après le 15 juin
       2026, c'est le 15 juin 2029 : un quantième qui existe dans le mois
       d'arrivée, donc hors du cas du quantième manquant que règle
       l'article 641 du code de procédure civile. Cette attente passe
       avant comme après le correctif. */
    await expect(valeurEcheance(page, 'Péremption permis'))
        .toHaveText(await dateAffichee(page, PEREMPTION));

    /* --- L'ASSERTION CENTRALE ---
       Deux mois après le 1er juillet, c'est le 1er septembre. Le compte en
       soixante jours tombe le 30 août : deux jours trop tôt, et c'est la
       date à laquelle le permis est réputé purgé de recours. */
    await expect(valeurEcheance(page, /Fin recours tiers|Recours purgé/))
        .toHaveText(await dateAffichee(page, FIN_RECOURS));

    /* Refermer la modale avant le nettoyage : l'overlay reste « active »
       et intercepterait le clic sur le sélecteur de projet. Le run
       35382016992 l'a dit mot pour mot sur permis-instruction-mois. */
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    await deleteActiveProject(page);
});
