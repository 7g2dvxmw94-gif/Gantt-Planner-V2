import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § K1 (raccourcis clavier) sous l'angle que
 * raccourcis-saisie-texte.spec.js laisse de côté : ce que les raccourcis
 * font quand une FENÊTRE MODALE est ouverte.
 *
 * LE DÉFAUT : les raccourcis globaux agissent sur la page DERRIÈRE la
 * fenêtre. Le gestionnaire en capture sur window ne consulte modaleOuverte()
 * que pour Ctrl+F. Suppr, Ctrl+Z, Ctrl+Y, Ctrl+A, 1/2/3 et « ? » ne testent
 * que saisieDeTexte() ; Échap ne teste rien. Or une fenêtre qui donne le
 * focus à un bouton — la croix du rapport DCMA, par exemple — n'est pas une
 * saisie de texte : dès son ouverture,
 *   - Suppr propose de supprimer la sélection d'arrière-plan ;
 *   - « ? » ouvre l'aide par-dessus la fenêtre ;
 *   - Échap ferme la fenêtre ET vide la sélection au passage.
 *
 * L'INVARIANT EST ÉCRIT DANS LE MÊME GESTIONNAIRE. Le commentaire de Ctrl+F
 * dit que `aria-modal="true"` promet « que rien au dehors n'est
 * atteignable », et le piège à focus de #78 le répète. Les autres branches
 * le démentent à quelques lignes de là.
 *
 * LE PARCOURS EST CELUI DE #85 : « Sélectionner (2) » dans le rapport DCMA
 * ferme la fenêtre et sélectionne deux tâches ; on rouvre le rapport pour
 * examiner un autre point. Le défaut précède le DCMA — il touche toutes les
 * fenêtres aria-modal —, mais ce parcours l'expose dès l'ouverture.
 *
 * TOUCHES ÉCARTÉES À DESSEIN. « 1/2/3 » change la vue, et la vue est
 * enregistrée dans les réglages du COMPTE PARTAGÉ : un rouge la laisserait
 * aux tests suivants. Ctrl+Z annulerait une écriture en base. Toutes
 * passent par la même branche que celles mesurées ici.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « effets des raccourcis, fenêtre ouverte ». */

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

test('les raccourcis globaux n\'agissent pas derrière une fenêtre modale', async ({ page }) => {
    const suffixe = Date.now();
    await page.goto('index.html');
    await createProject(page, `E2E RaccModale ${suffixe}`);
    await creerTache(page, `Terrassement ${suffixe}`, '2026-06-01', '2026-06-05');
    await creerTache(page, `Fondations ${suffixe}`, '2026-06-08', '2026-06-12');

    /* Deux tâches sans liens : le point 1 du rapport est en alerte sur les
       deux. « Sélectionner (2) » ferme la fenêtre et les sélectionne. */
    const modale = page.locator('#dcmaReportModal');
    await page.locator('#dcmaBtn').click();
    await expect(modale.locator('tr[data-dcma-point="1"] .dcma-valeur')).toHaveText('100 % (2/2)');
    await modale.locator('[data-dcma-selection="1"]').click();
    await expect(modale).toHaveCount(0);
    const selection = page.locator('.gantt-bar.selected');
    await expect(selection).toHaveCount(2);

    /* Toute boîte de dialogue native est notée puis REFUSÉE : aucune
       suppression n'a lieu, défaut ou pas. */
    const dialogues = [];
    const noter = (d) => { dialogues.push(d.message()); return d.dismiss(); };
    page.on('dialog', noter);

    /* DISCRIMINANT 1 — FENÊTRE FERMÉE, SUPPR AGIT SUR LA SÉLECTION. Cela
       établit que la touche est branchée, que la frappe de Playwright
       l'atteint et que la sélection est active. Sans ce préalable, une
       absence d'effet plus bas pourrait seulement vouloir dire que la
       touche n'arrive nulle part. Passe avant comme après. */
    await page.keyboard.press('Delete');
    await expect.poll(() => dialogues, { message: 'Suppr, fenêtre fermée' }).toEqual(['Supprimer 2 tâches ?']);
    await expect(selection).toHaveCount(2);
    dialogues.length = 0;

    await page.locator('#dcmaBtn').click();
    await expect(modale).toBeVisible();

    /* DISCRIMINANT 2 — LE FOCUS EST SUR LA CROIX, PAS DANS UN CHAMP. Les
       raccourcis s'effacent devant une saisie de texte (#55) : si le focus
       était dans un champ de date, leur silence ne prouverait rien. Passe
       avant comme après. */
    await expect(modale.locator('.dcma-close')).toBeFocused();

    await page.keyboard.press('Delete');
    await page.keyboard.press('?');
    await page.keyboard.press('Escape');

    /* DISCRIMINANT 3 — ÉCHAP ATTEINT LA FENÊTRE ET LA FERME. Les frappes
       sont traitées dans l'ordre : une fois la fenêtre fermée, Suppr et
       « ? » l'ont été aussi, et leurs effets sont acquis. Passe avant comme
       après. */
    await expect(modale).toHaveCount(0);

    // --- L'ASSERTION CENTRALE ---
    expect({ dialogues, aide: await page.locator('.kbd-close').count(), selection: await selection.count() },
        'effets des raccourcis, fenêtre ouverte').toEqual({ dialogues: [], aide: 0, selection: 2 });

    page.off('dialog', noter);
    await page.keyboard.press('Escape');
    await expect(selection).toHaveCount(0);
    await deleteActiveProject(page);
});
