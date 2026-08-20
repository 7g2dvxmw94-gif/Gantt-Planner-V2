import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, expectProjectName, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1, volet baselines.

   Sixième occurrence du motif « écriture locale tenue pour terminée alors
   que rien n'est parti sur le réseau », et sa variante la plus sournoise :
   le schéma prévoit le champ, le code le relit, et personne ne l'écrit.

     - projects.active_baseline_id EXISTE (migration 001:53), avec sa clé
       étrangère vers baselines ;
     - supabase-store.js:98 la RELIT au chargement (rowToProject) ;
     - mais la RPC upsert_project prend dix paramètres, et celui-là n'en
       fait pas partie.

   DEUX chemins mènent à ce champ, et tous deux s'arrêtent à la mémoire :

     1. createBaseline() auto-active la baseline qu'elle vient de créer
        (store.js:1509-1511). La baseline, elle, part bien en base ; son
        activation, non.
     2. setActiveBaseline() écrit proj.activeBaselineId, appelle _save(),
        et s'arrête là.

   D'où deux tests SÉPARÉS : réunis, le premier échec masquerait le second.

   À NOTER — createBaseline() persiste la baseline elle-même. Les lignes du
   popover survivent donc au rechargement ; seul leur état actif se perd.
   Chaque test l'asserte avant de juger l'activation, sans quoi un rouge
   serait ambigu.

   PIÈGE, éprouvé en CI — un clic sur une ligne BASCULE l'activation
   (app.js:1672, `isActive ? null : bl.id`). Cliquer la baseline qu'on vient
   de créer la DÉSACTIVE, puisqu'elle est déjà active. Le second test crée
   donc deux baselines et clique sur la première, celle que l'auto-activation
   de la seconde a laissée inactive. */

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

test('la baseline auto-activée à sa création le reste après rechargement', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet   = `E2E BaselineAuto ${suffixe}`;
    const nomTache    = `Tâche de référence ${suffixe}`;
    const nomBaseline = `Référence auto ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomTache);

    await ouvrirPopover(page);
    const ligne = await creerBaseline(page, nomBaseline);
    // createBaseline() auto-active : c'est visible immédiatement.
    await expect(ligne).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    await page.reload();
    await waitForAppReady(page);
    await expectProjectName(page, nomProjet);
    await ouvrirPopover(page);

    const ligneApres = page.locator('.bl-pop-item').filter({ hasText: nomBaseline });
    // La baseline a survécu — createBaseline fait bien ce travail-là.
    await expect(ligneApres).toBeVisible({ timeout: 10_000 });
    // --- L'assertion centrale --- son auto-activation doit survivre aussi.
    await expect(ligneApres).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });

    await fermerPopover(page);
    await deleteActiveProject(page);
});

test('la baseline activée à la main le reste après rechargement', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E BaselineChoix ${suffixe}`;
    const nomTache  = `Tâche de référence ${suffixe}`;
    const nomA      = `Référence A ${suffixe}`;
    const nomB      = `Référence B ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomTache);

    await ouvrirPopover(page);
    const ligneA = await creerBaseline(page, nomA);
    // La seconde création auto-active B, ce qui laisse A inactive.
    const ligneB = await creerBaseline(page, nomB);
    await expect(ligneB).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneA).not.toHaveClass(/bl-pop-item--active/);

    // Choisir A : c'est setActiveBaseline() qui s'exécute, pas un toggle vers null.
    await ligneA.click();
    await expect(ligneA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneB).not.toHaveClass(/bl-pop-item--active/);

    await page.reload();
    await waitForAppReady(page);
    await expectProjectName(page, nomProjet);
    await ouvrirPopover(page);

    const ligneAprèsA = page.locator('.bl-pop-item').filter({ hasText: nomA });
    const ligneAprèsB = page.locator('.bl-pop-item').filter({ hasText: nomB });
    // Les deux baselines ont survécu.
    await expect(ligneAprèsA).toBeVisible({ timeout: 10_000 });
    await expect(ligneAprèsB).toBeVisible({ timeout: 10_000 });
    // --- L'assertion centrale --- le choix de l'utilisateur, lui aussi.
    await expect(ligneAprèsA).toHaveClass(/bl-pop-item--active/, { timeout: 10_000 });
    await expect(ligneAprèsB).not.toHaveClass(/bl-pop-item--active/);

    await fermerPopover(page);
    await deleteActiveProject(page);
});
