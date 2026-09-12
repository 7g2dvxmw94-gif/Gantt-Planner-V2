import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B4 (permis de construire), sous l'angle que
 * permit.spec.js laisse de côté — et qu'il verrouille même à l'envers,
 * voir plus bas.
 *
 * LE DÉFAUT : le code dit UN MOIS et calcule TRENTE JOURS.
 *
 *     // Completeness deadline (1 month from deposit)
 *     deadlines.completenessDeadline = formatDateISO(addDays(deposit, 30));
 *
 * Deux lignes consécutives, et elles se contredisent. Un mois n'est égal
 * à trente jours que pour les mois qui en comptent trente.
 *
 * LE VERDICT NE DEMANDE PAS D'ARBITRER LE DROIT, et c'est ce qui le rend
 * décidable ici : le test ne dit pas ce que le Code de l'urbanisme exige,
 * il dit que le code doit faire ce qu'il annonce faire. C'est la forme de
 * défaut la plus fréquente de ce dépôt — un invariant énoncé à un endroit
 * et contredit juste à côté.
 *
 * LE PRÉCÉDENT EST DANS LE MÊME FICHIER, trente lignes plus bas :
 *
 *     // addYears et non addDays(…, n * 365) : trois ans ne font 1095
 *     // jours que si aucun 29 février ne tombe dans l'intervalle.
 *
 * La même raison vaut pour les mois, et beaucoup plus souvent : sept mois
 * sur douze n'ont pas trente jours.
 *
 * TROIS LECTURES POSSIBLES, ET LE TEST LES SÉPARE TOUTES. Mesuré hors
 * navigateur avant d'écrire ce fichier :
 *
 *     dépôt        +30 jours    setMonth naïf   1 mois calé
 *     2026-04-01   2026-05-01   2026-05-01      2026-05-01
 *     2026-01-31   2026-03-02   2026-03-03      2026-02-28
 *     2026-08-10   2026-09-09   2026-09-10      2026-09-10
 *     2026-03-31   2026-04-30   2026-05-01      2026-04-30
 *
 * Le « setMonth naïf » est la manière dont on corrige ce défaut de
 * travers : JavaScript fait déborder le 31 janvier sur le 3 mars au lieu
 * de le caler sur le 28 février. Le test le refuse explicitement.
 *
 * PERMIT.SPEC.JS VERROUILLAIT LE DÉFAUT. Sa constante disait
 * `COMPLETENESS = '2026-09-09'  // dépôt + 30 j`. Elle est corrigée au
 * 10 septembre dans le même commit que ce fichier : un test qui fige un
 * comportement fautif doit être changé au grand jour, jamais en silence.
 */

/* Ces trois auxiliaires sont repris de permit.spec.js. Les partager
   demanderait de les déplacer dans e2e/helpers.js, ce qui déborderait de
   ce correctif ; la duplication est signalée plutôt que masquée. */
async function dateAffichee(page, iso) {
    return page.evaluate((d) => {
        const [y, m, day] = d.split('-').map(Number);
        const locale = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }[localStorage.getItem('gantt_lang')] || 'fr-FR';
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

test('la limite de complétude se compte en mois, pas en 30 jours', async ({ page }) => {
    const nomProjet = `E2E Completude ${Date.now()}`;
    const nomPermis = `DP Clôture ${Date.now()}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    await page.locator('#addTaskBtn').click();
    await page.locator('.type-switcher-btn[data-type="permit"]').click();
    await page.locator('#taskName').fill(nomPermis);
    await page.locator('#taskStart').fill('2026-01-01');
    await page.locator('#taskEnd').fill('2026-12-31');

    /* DISCRIMINANT — L'ÉCHÉANCE EST CALCULÉE ET AFFICHÉE.
       Avril compte trente jours : le 1er avril donne le 1er mai dans les
       TROIS lectures, la fautive comme les deux autres. Exiger cette
       valeur établit que le champ est branché et que le calcul tourne,
       sans rien préjuger du défaut. Sans ce point, une échéance vide ou
       absente ferait échouer les assertions centrales pour une raison
       étrangère à ce qu'elles mesurent. */
    await champDepot(page).fill('2026-04-01');
    await expect(valeurEcheance(page, 'Limite complétude'))
        .toHaveText(await dateAffichee(page, '2026-05-01'), { timeout: 10_000 });

    /* --- PREMIÈRE ASSERTION CENTRALE ---
       Le 31 janvier sépare les trois lectures d'un coup. Un mois plus tard
       c'est le 28 février — février n'ayant pas de 31, l'échéance se cale
       sur le dernier jour du mois. Le compte en jours donne le 2 mars,
       deux jours trop tard ; un setMonth sans calage donnerait le 3 mars,
       soit un jour de plus encore, dans un mois qui n'est même pas le
       bon. */
    await champDepot(page).fill('2026-01-31');
    await expect(valeurEcheance(page, 'Limite complétude'))
        .toHaveText(await dateAffichee(page, '2026-02-28'));

    /* --- SECONDE ASSERTION CENTRALE ---
       Le cas ordinaire, sans calage : le 10 août donne le 10 septembre.
       C'est la date que permit.spec.js attendait au 9 septembre, et le
       même commit l'y corrige. */
    await champDepot(page).fill('2026-08-10');
    await expect(valeurEcheance(page, 'Limite complétude'))
        .toHaveText(await dateAffichee(page, '2026-09-10'));

    /* CE TROISIÈME CAS N'EST PAS UN ROUGE — il passe avant comme après le
       correctif, et c'est ce qu'on lui demande.

       Le 31 mars donne le 30 avril en comptant les jours comme en comptant
       les mois : les deux lectures coïncident par hasard. Mais un setMonth
       sans calage donnerait le 1er mai. Ce cas ne mesure donc pas le
       défaut, il mesure la FORME du correctif — et il est le seul à
       pouvoir attraper la mauvaise manière de le corriger dans un mois
       qui n'est pas février. */
    await champDepot(page).fill('2026-03-31');
    await expect(valeurEcheance(page, 'Limite complétude'))
        .toHaveText(await dateAffichee(page, '2026-04-30'));

    await page.locator('#taskModalOverlay')
        .locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await deleteActiveProject(page);
});
