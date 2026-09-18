import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (permis) : le délai d'instruction se compte en
 * MOIS, pas en multiples de trente jours.
 *
 * LE TEXTE. Article R*423-23 du code de l'urbanisme, en vigueur depuis le
 * 1er octobre 2007, textuellement :
 *
 *     « Le délai d'instruction de droit commun est de :
 *       a) Un mois pour les déclarations préalables ;
 *       b) Deux mois pour les demandes de permis de démolir et pour les
 *          demandes de permis de construire portant sur une maison
 *          individuelle […] ;
 *       c) Trois mois pour les autres demandes de permis de construire et
 *          pour les demandes de permis d'aménager. »
 *
 * Et l'article R*423-24 majore ce délai d'UN MOIS, notamment lorsque le
 * projet est situé dans les abords des monuments historiques — ce que le
 * formulaire appelle « secteur ABF ».
 *
 * LE CODE. PERMIT_TYPES encode 30, 60 et 90 JOURS, ABF_EXTRA_DAYS vaut 30,
 * et calculatePermitDeadlines applique addDays(baseDate, instructionDays).
 * Les magnitudes sont justes — ce sont les nombres de mois multipliés par
 * trente —, c'est l'unité qui ne l'est pas.
 *
 * L'AMPLEUR, MESURÉE SUR LES 365 DATES DE DÉPÔT DE 2026 :
 *
 *     DP      30 j / 1 mois    240 dépôts sur 365 divergent
 *     PCM, PD 60 j / 2 mois    364 dépôts sur 365 divergent
 *     PC, PA  90 j / 3 mois    303 dépôts sur 365 divergent
 *
 * Ce n'est donc pas un cas limite : pour un permis de maison individuelle,
 * la date annoncée est fausse 364 jours sur 365, d'un à deux jours.
 *
 * ET CE N'EST PAS UNE DATE INDICATIVE. calculatePermitDeadlines pose
 * `deadlines.tacitApprovalDate = deadlines.decisionDeadline` : c'est la
 * date d'acquisition du PERMIS TACITE qui est annoncée à côté.
 *
 * LE MÊME DÉFAUT A DÉJÀ ÉTÉ CORRIGÉ HUIT LIGNES PLUS HAUT. La limite de
 * complétude comptait trente jours là où le commentaire annonçait « 1 month
 * from deposit » ; permis-completude-mois.spec.js l'a établi et le calcul
 * passe désormais par addMonths(). La ligne de la décision, juste en
 * dessous dans la même fonction, est restée en jours.
 *
 * LE 1er MARS 2026 EST CHOISI À DESSEIN : c'est une date où les deux
 * lectures divergent de DEUX jours, et non d'un seul. Un écart d'un jour
 * pourrait passer pour un arrondi ; deux jours ne le peuvent pas.
 *
 *     dépôt 2026-03-01    code 2026-05-30    loi 2026-06-01
 */

const DEPOT = '2026-03-01';

/* Un mois après le dépôt. DÉJÀ CORRECT depuis permis-completude-mois :
   c'est le discriminant, pas l'objet du test. */
const COMPLETUDE = '2026-04-01';

/* Trois mois après le dépôt (R*423-23 c). Le code en annonce 2026-05-30. */
const DECISION = '2026-06-01';

/** Rend une date ISO comme l'app le fait. Calculé DANS la page : le format
 *  dépend de la locale et de l'ICU du navigateur, qu'on ne réimplémente
 *  pas — seul le calcul de l'échéance est l'objet du test. */
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

function champDepot(page) {
    return page.locator('.permit-fields .form-group')
        .filter({ hasText: 'Date de dépôt' })
        .locator('input[type="date"]');
}

test('le délai d\'instruction se compte en mois, pas en tranches de trente jours', async ({ page }) => {
    const suffixe = Date.now();

    await page.goto('index.html');
    await createProject(page, `E2E InstructionMois ${suffixe}`);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(`PC Halle ${suffixe}`);
    await page.locator('#taskStart').fill('2026-03-01');
    await page.locator('#taskEnd').fill('2026-07-31');

    /* PREMIER DISCRIMINANT — LE TYPE EST BIEN UN PC.
       Trois mois ne valent que pour les permis de construire ordinaires et
       les permis d'aménager (R*423-23 c). Sur une déclaration préalable,
       l'échéance attendue serait tout autre et l'assertion centrale
       n'aurait aucun sens. */
    await expect(page.locator('#permitType')).toHaveValue('PC');

    await champDepot(page).fill(DEPOT);

    /* SECOND DISCRIMINANT — LA LIMITE DE COMPLÉTUDE EST JUSTE.
       Elle se compte en mois depuis permis-completude-mois, et elle sort de
       LA MÊME FONCTION, huit lignes au-dessus de la ligne fautive. L'exiger
       établit d'un coup que le dépôt a bien été pris, que le panneau des
       échéances est rendu, et que l'arithmétique en mois fonctionne déjà
       ici — de sorte qu'un échec plus bas ne pourra venir que de l'unité
       employée pour l'instruction. Cette attente passe avant comme après le
       correctif. */
    await expect(valeurEcheance(page, 'Limite complétude'))
        .toHaveText(await dateAffichee(page, COMPLETUDE));

    /* --- L'ASSERTION CENTRALE ---
       Trois mois après le 1er mars, c'est le 1er juin. Le compte en
       quatre-vingt-dix jours tombe le 30 mai : deux jours plus tôt, et
       c'est la date du permis tacite. */
    await expect(valeurEcheance(page, 'Décision prévisionnelle'))
        .toContainText(await dateAffichee(page, DECISION));

    /* --- CE QUE LIT L'UTILISATEUR ---
       Le panneau annonce « 90 jours ». Même quand la date serait juste, le
       libellé enseignerait une règle fausse à qui s'y fie pour raisonner
       sur un autre dossier. */
    await expect(valeurEcheance(page, "Délai d'instruction")).toHaveText('3 mois');

    await deleteActiveProject(page);
});
