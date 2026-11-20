import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* « Aujourd'hui » inscrit la date du jour dans le champ « Date d'état ».
 *
 * LE DÉFAUT (signalé par l'utilisateur, 20/11/2026) : dans le panneau
 * « Date d'état » de la barre d'outils, cliquer « Aujourd'hui » ne fait
 * rien de visible. Le bouton EFFAÇAIT la date (vide = date du jour,
 * implicitement) : le champ restait vide ; et sur un projet sans date
 * d'état, il n'y avait rien à effacer.
 *
 * LA RÈGLE : « Aujourd'hui » inscrit la date du jour dans le champ et
 * l'enregistre comme date d'état du projet — y compris quand une autre
 * date y était.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « « Aujourd'hui » inscrit la date du jour dans le champ » :
 * champ vide. Les discriminants — le panneau s'ouvre, le champ est vide
 * sur un projet neuf — passent. */

const lireDateEtat = (page) => page.evaluate(async () => {
    const { store } = await import(new URL('js/store.js', document.baseURI).href);
    return store.getActiveProject()?.statusDate ?? null;
});

test('« Aujourd\'hui » inscrit la date du jour dans le champ de la date d\'état', async ({ page }) => {
    const nomProjet = `E2E DateEtatAujourdhui ${Date.now()}`;
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, nomProjet);

    /* La date du jour, calculée dans la page comme l'application. */
    const aujourdhui = await page.evaluate(async () => {
        const { formatDateISO } = await import(new URL('js/utils.js', document.baseURI).href);
        return formatDateISO(new Date());
    });

    await page.locator('.toolbar-actions #dateEtatBtn').click();
    const champ = page.locator('#dateEtatChamp');

    /* DISCRIMINANTS — le panneau s'ouvre ; projet neuf : champ vide.
       Ferment « la date viendrait d'ailleurs ». Passent avant comme après. */
    await expect(champ, 'le panneau s\'ouvre sur le champ de date').toBeVisible();
    await expect(champ, 'projet neuf : champ vide').toHaveValue('');

    // --- L'ASSERTION CENTRALE ---
    await page.locator('#dateEtatAujourdhui').click();
    await expect(champ, '« Aujourd\'hui » inscrit la date du jour dans le champ').toHaveValue(aujourdhui);
    await expect.poll(() => lireDateEtat(page), { message: 'et l\'enregistre comme date d\'état' }).toBe(aujourdhui);

    /* Une autre date était réglée : « Aujourd'hui » la remplace. */
    await champ.fill('2026-06-10');
    await champ.dispatchEvent('change');
    await expect.poll(() => lireDateEtat(page), { message: 'autre date écrite' }).toBe('2026-06-10');
    await page.locator('#dateEtatAujourdhui').click();
    await expect(champ, 'la date du jour remplace l\'autre').toHaveValue(aujourdhui);
    await expect.poll(() => lireDateEtat(page), { message: 'et elle est enregistrée' }).toBe(aujourdhui);

    await page.keyboard.press('Escape');
    await deleteActiveProject(page);
});
