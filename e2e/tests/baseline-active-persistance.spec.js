import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1, volet baselines.
 *
 * Sixième occurrence du motif « écriture locale tenue pour terminée alors
 * que rien n'est parti sur le réseau », et sa variante la plus sournoise :
 * le schéma prévoit le champ, le code le relit, et personne ne l'écrit.
 *
 *   - projects.active_baseline_id EXISTE (migration 001:53), avec sa clé
 *     étrangère vers baselines ;
 *   - supabase-store.js:98 la RELIT au chargement (rowToProject) ;
 *   - mais la RPC upsert_project prend dix paramètres, et celui-là n'en
 *     fait pas partie.
 *
 * store.setActiveBaseline() écrit donc proj.activeBaselineId en mémoire,
 * appelle _save(), et s'arrête là. Le choix de la référence de comparaison
 * ne survit pas au rechargement.
 *
 * À NOTER — createBaseline() persiste correctement, elle. Les baselines
 * elles-mêmes survivent ; c'est uniquement le choix de l'active qui se
 * perd. Le test doit donc distinguer les deux, sans quoi un échec serait
 * ambigu.
 */

const popover = '#baselinePopover';

async function ouvrirPopover(page) {
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeVisible({ timeout: 10_000 });
}

test('la baseline active survit à un rechargement', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet   = `E2E Baseline ${suffixe}`;
    const nomTache    = `Tâche de référence ${suffixe}`;
    const nomBaseline = `Référence ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);

    // Une baseline fige les tâches du projet : il en faut au moins une.
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nomTache);
    await page.locator('#taskStart').fill('2026-12-14');
    await page.locator('#taskEnd').fill('2026-12-16');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nomTache }))
        .toBeVisible({ timeout: 10_000 });

    // --- Créer la baseline, puis l'activer ---
    await ouvrirPopover(page);
    await page.locator('.bl-create-input').fill(nomBaseline);
    await page.locator('.bl-create-btn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: nomBaseline }))
        .toBeVisible({ timeout: 10_000 });

    const ligne = page.locator('.bl-pop-item').filter({ hasText: nomBaseline });
    await expect(ligne).toBeVisible({ timeout: 10_000 });
    await ligne.click();
    await expect(ligne).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    /* --- L'assertion centrale ---
       La baseline elle-même est persistée par createBaseline() : elle sera
       toujours là après rechargement. Ce qui est en jeu, c'est uniquement
       son état ACTIF, que rien n'écrit en base. */
    await page.reload();
    await waitForAppReady(page);
    await expectProjectName(page, nomProjet);
    await ouvrirPopover(page);

    const ligneApres = page.locator('.bl-pop-item').filter({ hasText: nomBaseline });
    // Elle a bien survécu — createBaseline fait son travail.
    await expect(ligneApres).toBeVisible({ timeout: 10_000 });
    // Mais son activation, elle, doit survivre aussi.
    await expect(ligneApres).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    /* Refermer par le bouton, qui bascule le popover. Escape ne le ferme
       pas — les gestionnaires Escape de app.js visent d'autres composants —
       et un popover resté ouvert pourrait intercepter le clic du sélecteur
       de projet lors du nettoyage. */
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeHidden();

    await deleteActiveProject(page);
});
