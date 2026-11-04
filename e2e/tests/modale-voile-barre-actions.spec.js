import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B10 (sélection multiple), sous l'angle des
 * fenêtres modales : la barre d'actions groupées doit passer SOUS leur
 * voile.
 *
 * LE DÉFAUT : la barre d'actions groupées est au-dessus du voile.
 *
 *     .batch-action-bar { position: fixed; …; z-index: 10000; }
 *     .modal-overlay    { …;                  z-index: var(--z-modal); }   // 100
 *
 * Une sélection faite avant d'ouvrir une fenêtre laisse donc la barre
 * visible ET CLIQUABLE par-dessus le voile : « ✕ Supprimer » agit sur la
 * page alors que la fenêtre, aria-modal, promet que rien au dehors n'est
 * atteignable. Si l'on confirme, les tâches disparaissent sous un rapport
 * DCMA qui les compte encore.
 *
 * LE PARCOURS EST CELUI DE #85 : « Sélectionner (2) » dans le rapport DCMA
 * ferme la fenêtre et sélectionne deux tâches ; on rouvre le rapport pour
 * examiner un autre point. Le défaut précède le DCMA — la valeur 10000 date
 * au plus tard de #31 —, et toute fenêtre à voile .modal-overlay y est
 * exposée, la fiche tâche comprise.
 *
 * LA MESURE NE CLIQUE PAS. document.elementFromPoint() au centre du bouton
 * « Supprimer » dit ce qu'un vrai clic y atteindrait : la barre, ou le
 * voile. Aucune suppression n'est donc proposée, défaut ou pas.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « ce qu'un clic sur « Supprimer » atteint, fenêtre ouverte ». */

/** Juin 2026 commence un lundi. */
async function creerTache(page, nom, debut, fin) {
    await page.locator('#addTaskBtn').click();
    await page.locator('#taskName').fill(nom);
    await page.locator('#taskStart').fill(debut);
    await page.locator('#taskEnd').fill(fin);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    const barre = page.locator('.gantt-bar[data-task-id]').filter({ hasText: nom });
    await expect(barre).toBeVisible({ timeout: 10_000 });
    return barre;
}

/** Ce qu'atteint un clic au point (x, y) : la fenêtre, la barre, ou autre chose. */
async function atteint(page, x, y) {
    return page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const fenetre = document.querySelector('#dcmaReportModal');
        const barre = document.querySelector('#batchActionBar');
        return fenetre && fenetre.contains(el) ? 'fenêtre' : barre && barre.contains(el) ? 'barre' : 'autre';
    }, [x, y]);
}

test('la barre d\'actions groupées passe sous le voile d\'une fenêtre modale', async ({ page }) => {
    const suffixe = Date.now();
    await page.goto('index.html');
    await createProject(page, `E2E VoileBarre ${suffixe}`);
    await creerTache(page, `Terrassement ${suffixe}`, '2026-06-01', '2026-06-05');
    await creerTache(page, `Fondations ${suffixe}`, '2026-06-08', '2026-06-12');

    /* Deux tâches sans liens : le point 1 du rapport est en alerte sur les
       deux. « Sélectionner (2) » ferme la fenêtre et les sélectionne. */
    const modale = page.locator('#dcmaReportModal');
    await page.locator('#dcmaBtn').click();
    await expect(modale.locator('tr[data-dcma-point="1"] .dcma-valeur')).toHaveText('100 % (2/2)');
    await modale.locator('[data-dcma-selection="1"]').click();
    await expect(modale).toHaveCount(0);

    const barre = page.locator('#batchActionBar');
    const supprimer = barre.locator('.batch-btn.danger');
    await expect(barre.locator('.batch-count')).toHaveText('2 tâches sélectionnées');
    await expect(supprimer).toHaveText(/Supprimer/);
    /* La barre entre par une animation de 200 ms qui la décale de 20 px
       (batchBarSlideUp) : la mesurer avant la fin viserait à côté du
       bouton, haut de 21 px. */
    await barre.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    const boite = await supprimer.boundingBox();
    expect(boite, 'bouton « Supprimer » rendu').not.toBeNull();
    const [x, y] = [boite.x + boite.width / 2, boite.y + boite.height / 2];

    /* DISCRIMINANT 1 — FENÊTRE FERMÉE, UN CLIC AU CENTRE DE « SUPPRIMER »
       ATTEINT LA BARRE. Il ferme deux mensonges du vert : que le point
       calculé ne soit pas sur le bouton, et que la mesure ne sache jamais
       répondre « barre ». Il fait aussi mesurer en CI que la barre reste
       cliquable hors des fenêtres. Passe avant comme après. */
    expect(await atteint(page, x, y), 'fenêtre fermée, ce qu\'un clic sur « Supprimer » atteint').toBe('barre');

    await page.locator('#dcmaBtn').click();
    await expect(modale).toBeVisible();

    /* DISCRIMINANT 2 — LA BARRE EST LÀ, FENÊTRE OUVERTE. Sans ce point, un
       clic qui n'atteint pas la barre pourrait venir de ce qu'elle a
       disparu à l'ouverture. Passe avant comme après. */
    await expect(barre.locator('.batch-count')).toHaveText('2 tâches sélectionnées');

    /* DISCRIMINANT 3 — LE VOILE EST LÀ ET REÇOIT LES CLICS. Au coin
       supérieur gauche, loin de la barre, un clic atteint la fenêtre. Il
       ferme un mensonge du rouge : un « barre » au centre du bouton
       pourrait venir d'un voile absent ou qui ne couvre pas la page, et non
       d'une barre posée au-dessus de lui. Passe avant comme après. */
    expect(await atteint(page, 5, 5), 'ce qu\'un clic atteint au coin (5, 5)').toBe('fenêtre');

    // --- L'ASSERTION CENTRALE ---
    expect(await atteint(page, x, y), 'ce qu\'un clic sur « Supprimer » atteint, fenêtre ouverte').toBe('fenêtre');

    /* Nettoyage : Échap ferme la fenêtre ; un second Échap vide la
       sélection si le premier ne l'a pas fait. */
    await page.keyboard.press('Escape');
    await expect(modale).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(barre).toHaveCount(0);
    await deleteActiveProject(page);
});
