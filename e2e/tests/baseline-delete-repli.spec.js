import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1, volet baselines — suite de #43.

   Septième occurrence du motif « écriture locale tenue pour terminée alors
   que rien n'est parti sur le réseau », et la seule où la base ne se
   contente pas d'ignorer l'écriture : elle en fait une AUTRE.

   Supprimer la baseline active déclenche deux réactions divergentes :

     - en mémoire, deleteBaseline() replie activeBaselineId sur la baseline
       restante la plus récente (store.js:1542-1546) ;
     - en base, la contrainte projects_active_baseline_fk est déclarée
       `on delete set null` (migration 001:169) : la colonne passe à NULL.

   Personne ne réconcilie les deux. L'écran montre donc une baseline active
   que la base dit inexistante, et le rechargement tranche en faveur de la
   base.

   #43 vient de rendre les DEUX autres chemins vers cette colonne durables
   (createBaseline et setActiveBaseline). Ce troisième-là était identifié à
   l'époque mais laissé ouvert, faute de rouge observé — le voici.

   CE QUE LE TEST DOIT SÉPARER, sans quoi un rouge serait ambigu :

     1. le repli local DOIT fonctionner — il est asserté avant le
        rechargement ; s'il tombe, le défaut est ailleurs ;
     2. la suppression DOIT avoir atteint la base — assertée après le
        rechargement par l'absence de la ligne supprimée ; si elle
        réapparaît, c'est le DELETE qui a échoué, la clé étrangère ne s'est
        jamais déclenchée, et le rouge suivant ne prouverait rien ;
     3. seulement alors, la persistance du repli — l'assertion centrale.

   PIÈGE hérité de baseline-active-persistance.spec.js : un clic sur une
   ligne BASCULE l'activation (app.js:1672). Ici on ne clique aucune ligne —
   l'auto-activation de la seconde création suffit à désigner la victime. */

const popover = '#baselinePopover';

async function ouvrirPopover(page) {
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeVisible({ timeout: 10_000 });
}

async function fermerPopover(page) {
    /* Par le bouton, qui bascule le popover. Escape ne le ferme pas — les
       gestionnaires Escape de app.js visent d'autres composants — et un
       popover resté ouvert intercepterait le clic du sélecteur de projet
       lors du nettoyage. */
    await page.locator('#baselineBtn').click();
    await expect(page.locator(popover)).toBeHidden();
}

/** Une tâche au moins : une baseline fige les tâches du projet. */
async function creerTache(page, nom) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill('2026-12-14');
    await page.locator('#taskEnd').fill('2026-12-16');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom }))
        .toBeVisible({ timeout: 10_000 });
}

/** Crée une baseline depuis le popover, déjà ouvert, et attend son toast. */
async function creerBaseline(page, nom) {
    await page.locator('.bl-create-input').fill(nom);
    await page.locator('.bl-create-btn').click();
    await expect(page.locator('#toastContainer .toast', { hasText: nom }))
        .toBeVisible({ timeout: 10_000 });
    const ligne = page.locator('.bl-pop-item').filter({ hasText: nom });
    await expect(ligne).toBeVisible({ timeout: 10_000 });
    return ligne;
}

test('supprimer la baseline active : le repli sur la restante survit au rechargement', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E BaselineSuppr ${suffixe}`;
    const nomTache  = `Tâche de référence ${suffixe}`;
    const nomA      = `Gardée ${suffixe}`;
    const nomB      = `Supprimée ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomTache);

    await ouvrirPopover(page);
    const ligneA = await creerBaseline(page, nomA);
    /* La seconde création auto-active B et laisse A inactive : B est donc
       la baseline active, celle dont la suppression déclenche le repli. */
    const ligneB = await creerBaseline(page, nomB);
    await expect(ligneB).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneA).not.toHaveClass(/bl-pop-item--active/);

    // --- Supprimer l'active ---
    await ligneB.locator('.bl-icon-btn--danger').click();
    await expect(ligneB).toHaveCount(0, { timeout: 10_000 });

    /* Le repli local, lui, fonctionne : A devient active à l'écran. C'est
       ce que l'utilisateur constate, et ce qui rend la divergence
       invisible jusqu'au rechargement suivant. */
    await expect(ligneA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    await page.reload();
    await waitForAppReady(page);
    await expectProjectName(page, nomProjet);
    await ouvrirPopover(page);

    const ligneApresA = page.locator('.bl-pop-item').filter({ hasText: nomA });
    const ligneApresB = page.locator('.bl-pop-item').filter({ hasText: nomB });

    // A a survécu — createBaseline() persiste bien les baselines.
    await expect(ligneApresA).toBeVisible({ timeout: 10_000 });
    /* B a bien disparu de la BASE, pas seulement de l'écran. Sans quoi le
       DELETE n'aurait pas eu lieu, la clé étrangère ne se serait jamais
       déclenchée, et l'assertion suivante ne prouverait rien. */
    await expect(ligneApresB).toHaveCount(0);

    /* --- L'assertion centrale ---
       Le repli était local ; la clé étrangère, elle, a mis la colonne à
       NULL. Plus aucune baseline n'est active, et le choix que l'écran
       affichait avant rechargement est perdu. */
    await expect(ligneApresA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    await fermerPopover(page);
    await deleteActiveProject(page);
});
