import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourcis clavier) là où il croise § G3
 * (export PDF) : ce que les raccourcis font quand la fenêtre d'export PDF
 * est ouverte.
 *
 * LE DÉFAUT : la fenêtre d'export PDF ne se déclare pas modale, et les
 * raccourcis globaux agissent derrière elle. #92 a remonté la garde
 * modaleOuverte() en tête du gestionnaire de raccourcis, mais cette garde
 * ne connaît que ce qui le déclare soi-même :
 *
 *     const modaleOuverte = () => Array.from(
 *         document.querySelectorAll('[aria-modal="true"]')
 *     ).some(el => el.checkVisibility({ visibilityProperty: true }));
 *
 * _showPDFExportDialog() pose un voile (.pdf-export-overlay) et une boîte
 * (.pdf-export-dialog) sans `role` ni `aria-modal`, puis donne le focus à
 * son bouton « Générer le PDF » — pas une saisie de texte. Dès l'ouverture :
 *   - Suppr propose de supprimer la sélection d'arrière-plan ;
 *   - « ? » ouvre l'aide par-dessus la fenêtre.
 * Le piège à focus générique de #78, adossé à la même convention, ne la
 * voit pas davantage.
 *
 * LE DÉFAUT EST ÉCRIT DANS LE CODE, À CÔTÉ DE LA GARDE. Son commentaire
 * nomme #pdfExportDialog parmi deux fenêtres qui « ne le font pas encore »
 * et renvoie leur cas à « un autre correctif ». L'autre, la popup de
 * partage de projet, ne s'ouvre que sur une notification Supabase venue
 * d'un autre compte : elle est mesurée hors navigateur, pas ici.
 *
 * LE PARCOURS EST CELUI DE #92 : « Sélectionner (2) » dans le rapport DCMA
 * sélectionne deux tâches ; on ouvre ensuite l'export PDF, par exemple pour
 * y joindre ce rapport (#86).
 *
 * TOUCHES ÉCARTÉES À DESSEIN. « 1/2/3 » change la vue, et la vue est
 * enregistrée dans les réglages du COMPTE PARTAGÉ : un rouge la laisserait
 * aux tests suivants. Ctrl+Z annulerait une écriture en base. Échap ne
 * ferme pas cette fenêtre, ni avant ni après le correctif — aucun
 * gestionnaire ne l'y écoute — et ce test ne juge pas ce manque.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « effets des raccourcis, fenêtre d'export PDF ouverte ». */

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

test('les raccourcis globaux n\'agissent pas derrière la fenêtre d\'export PDF', async ({ page }) => {
    /* Chaque frappe qui atteint la page est notée AVANT tout gestionnaire de
       l'application : ce script est posé avant le chargement, son écouteur
       passe donc le premier sur window en phase de capture, et le
       stopImmediatePropagation() des raccourcis ne peut pas l'en priver. */
    await page.addInitScript(() => {
        window.__frappes = [];
        window.addEventListener('keydown', (e) => window.__frappes.push(e.key), true);
    });

    const suffixe = Date.now();
    await page.goto('index.html');
    await createProject(page, `E2E ExportRacc ${suffixe}`);
    await creerTache(page, `Terrassement ${suffixe}`, '2026-06-01', '2026-06-05');
    await creerTache(page, `Fondations ${suffixe}`, '2026-06-08', '2026-06-12');

    /* Deux tâches sans liens : le point 1 du rapport est en alerte sur les
       deux. « Sélectionner (2) » ferme la fenêtre et les sélectionne. */
    const rapport = page.locator('#dcmaReportModal');
    await page.locator('#dcmaBtn').click();
    await expect(rapport.locator('tr[data-dcma-point="1"] .dcma-valeur')).toHaveText('100 % (2/2)');
    await rapport.locator('[data-dcma-selection="1"]').click();
    await expect(rapport).toHaveCount(0);
    const selection = page.locator('.gantt-bar.selected');
    await expect(selection).toHaveCount(2);

    /* Toute boîte de dialogue native est notée puis REFUSÉE : aucune
       suppression n'a lieu, défaut ou pas. */
    const dialogues = [];
    const noter = (d) => { dialogues.push(d.message()); return d.dismiss(); };
    page.on('dialog', noter);

    /* DISCRIMINANT 1 — AUCUNE FENÊTRE, SUPPR ET « ? » AGISSENT. Pour
       chacune des deux touches que l'assertion centrale juge, cela établit
       qu'elle est branchée, que la frappe de Playwright l'atteint, et —
       pour Suppr — que la sélection est active. Sans ce préalable, une
       absence d'effet plus bas pourrait seulement vouloir dire que la
       touche n'arrive nulle part : un « ? » débranché, ou une frappe que
       Playwright ne livrerait pas sous la forme `e.key === '?'` attendue
       par le gestionnaire, donnerait `aide: 0` fenêtre ouverte sans
       qu'aucune garde y soit pour rien.
       L'aide est ensuite refermée par sa croix, .kbd-close, le sélecteur
       même que l'assertion centrale compte. Passe avant comme après. */
    await page.keyboard.press('Delete');
    await expect.poll(() => dialogues, { message: 'Suppr, aucune fenêtre ouverte' }).toEqual(['Supprimer 2 tâches ?']);
    await expect(selection).toHaveCount(2);
    dialogues.length = 0;
    await page.keyboard.press('?');
    const fermerAide = page.locator('.kbd-close');
    await expect(fermerAide, '« ? », aucune fenêtre ouverte').toHaveCount(1);
    await fermerAide.click();
    await expect(fermerAide).toHaveCount(0);

    await page.locator('#exportBtn').click();
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: /^PDF$/ }) })
        .click();
    const fenetre = page.locator('#pdfExportDialog');
    await expect(fenetre).toBeVisible({ timeout: 10_000 });

    /* DISCRIMINANT 2 — LE FOCUS EST SUR « GÉNÉRER LE PDF », PAS DANS UN
       CHAMP. Les raccourcis s'effacent devant une saisie de texte (#55), et
       la fenêtre a deux champs de date : si le focus était dans l'un d'eux,
       le silence des raccourcis ne prouverait rien. Passe avant comme
       après. */
    await expect(fenetre.locator('.pdf-export-confirm')).toBeFocused();

    /* DISCRIMINANT 3 — LA SÉLECTION A SURVÉCU À L'OUVERTURE. Suppr ne fait
       rien sur une sélection vide : sans ce point, un silence de Suppr
       pourrait venir de ce qu'ouvrir l'export l'a vidée, et non d'une
       garde. Passe avant comme après. */
    await expect(selection).toHaveCount(2);

    await page.evaluate(() => { window.__frappes.length = 0; });
    await page.keyboard.press('Delete');
    await page.keyboard.press('?');

    /* DISCRIMINANT 4 — LES DEUX FRAPPES ONT ATTEINT LA PAGE, FENÊTRE
       OUVERTE, AVANT LA MESURE. Il ferme le mensonge du vert que serait une
       frappe perdue ou pas encore traitée : l'écouteur qui les note passe
       avant les raccourcis, dans la même distribution, donc leurs effets
       éventuels sont acquis quand il les a vues. Passe avant comme après. */
    await expect.poll(() => page.evaluate(() => window.__frappes), { message: 'frappes reçues, fenêtre d\'export PDF ouverte' })
        .toEqual(['Delete', '?']);

    // --- L'ASSERTION CENTRALE ---
    expect({ dialogues, aide: await page.locator('.kbd-close').count(), selection: await selection.count() },
        'effets des raccourcis, fenêtre d\'export PDF ouverte').toEqual({ dialogues: [], aide: 0, selection: 2 });

    page.off('dialog', noter);
    await fenetre.locator('.pdf-export-cancel').click();
    await expect(fenetre).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(selection).toHaveCount(0);
    await deleteActiveProject(page);
});
