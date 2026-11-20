import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* La date d'état se règle dans la barre d'outils.
 *
 * LE BESOIN (demande de l'utilisateur). La date d'état — la « status
 * date » de MS Project, à laquelle on fait le point d'avancement — est un
 * champ du projet (projects.status_date, migration 028). Elle ne se
 * réglait que dans la fenêtre du rapport DCMA : hors de ce rapport,
 * l'utilisateur ne la voyait ni ne la changeait.
 *
 * LA RÈGLE : un bouton « Date d'état » dans la barre d'outils, à côté de
 * « Baseline », ouvre un panneau avec le champ de date et « Aujourd'hui »
 * (qui y inscrit la date du jour : date-etat-aujourdhui.spec.js). Vide,
 * la date d'état est la date du jour, comme dans le rapport DCMA. Le nom
 * accessible et l'infobulle du bouton disent la date
 * en vigueur. C'est le MÊME champ du projet que celui du rapport DCMA :
 * régler l'un se lit dans l'autre, et la valeur survit au rechargement.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « bouton « Date d'état » absent de la barre d'outils ». Le
 * discriminant — le projet neuf n'a pas de date d'état — passe. */

const lireDateEtat = (page) => page.evaluate(async () => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    return store.getActiveProject()?.statusDate ?? null;
});

const affichee = (page, iso) => page.evaluate(async (iso) => {
    const { formatDateDisplay } = await import(new URL('js/utils.js', document.baseURI).href);
    return formatDateDisplay(iso);
}, iso);

test('la date d\'état se règle dans la barre d\'outils, et c\'est celle du rapport DCMA', async ({ page }) => {
    const nomProjet = `E2E DateEtatBarre ${Date.now()}`;
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, nomProjet);

    /* DISCRIMINANT — LE PROJET NEUF N'A PAS DE DATE D'ÉTAT. Ferme « la
       date relue viendrait d'un autre test ou d'un autre projet ». Passe
       avant comme après. */
    expect(await lireDateEtat(page), 'projet neuf : aucune date d\'état').toBeNull();

    // --- L'ASSERTION CENTRALE ---
    const bouton = page.locator('.toolbar-actions #dateEtatBtn');
    await expect(bouton, 'bouton « Date d\'état » absent de la barre d\'outils').toHaveCount(1);
    await expect(bouton, 'visible dans la barre').toBeVisible();
    await expect(bouton, 'sans date, il dit la date du jour')
        .toHaveAttribute('aria-label', /Date d'état.*aujourd'hui/);

    await bouton.click();
    const champ = page.locator('#dateEtatChamp');
    await expect(champ, 'le panneau s\'ouvre sur le champ de date').toBeVisible();
    await champ.fill('2026-06-10');
    await champ.dispatchEvent('change');
    await expect.poll(() => lireDateEtat(page), { message: 'la date d\'état du projet est écrite' }).toBe('2026-06-10');
    const juin10 = await affichee(page, '2026-06-10');
    await expect(bouton, 'le bouton dit la date réglée').toHaveAttribute('aria-label', new RegExp(juin10));
    await expect(bouton, 'son infobulle aussi').toHaveAttribute('title', new RegExp(juin10));

    /* LE MÊME CHAMP QUE LE RAPPORT DCMA. */
    await page.keyboard.press('Escape');
    await expect(champ, 'Échap ferme le panneau').toBeHidden();
    await page.locator('#dcmaBtn').click();
    await expect(page.locator('#dcmaDateEtat'), 'le rapport DCMA lit la même date').toHaveValue('2026-06-10');
    await page.locator('#dcmaReportModal .dcma-close').click();
    await expect(page.locator('#dcmaReportModal')).toHaveCount(0);

    /* GARDÉE AU RECHARGEMENT. */
    await page.reload();
    await waitForAppReady(page);
    await expect.poll(() => lireDateEtat(page), { message: 'relue après rechargement', timeout: 15_000 }).toBe('2026-06-10');
    await expect(bouton, 'après rechargement, le bouton dit la date').toHaveAttribute('aria-label', new RegExp(juin10));

    /* « Aujourd'hui » : voir date-etat-aujourdhui.spec.js. */
    await deleteActiveProject(page);
});
