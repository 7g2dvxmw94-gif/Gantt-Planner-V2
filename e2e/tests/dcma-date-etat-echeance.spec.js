import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle du rapport
 * DCMA 14 points : la date d'état et l'échéance du projet.
 *
 * ARBITRAGE DE L'UTILISATEUR : la date d'état est un CHAMP DU PROJET, et
 * l'échéance un NOUVEAU champ — distinct de end_date, qui vaut « création
 * + 90 jours » et n'est modifiable nulle part (migration 028). Tant qu'ils
 * manquent, le rapport prend la date du jour et ne mesure ni la marge
 * négative (point 7) ni le CPLI (point 13) faute de cible.
 *
 * CE QUI EST MESURÉ : les deux champs se saisissent dans la fenêtre du
 * rapport, le rapport se recalcule avec eux, et ils SURVIVENT À UN
 * RECHARGEMENT — c'est ce qui en fait des champs du projet plutôt qu'un
 * réglage d'affichage.
 *
 * UNE CHAÎNE DE TROIS TÂCHES, A → B → C en Fin→Début, du lundi 1er juin au
 * vendredi 19 juin 2026. Date d'état : lundi 8 juin ; échéance : vendredi
 * 26 juin. Comptés à la main, puis mesurés avec le texte réel du moteur :
 *   7  la fin prévue (19 juin) précède l'échéance de 5 jours ouvrés :
 *      aucune marge négative → 0 % (0/3), conforme ;
 *   9  A finit le 5 juin sans être commencée → 1 date invalide ;
 *  13  CPLI = (CPL + TF) / CPL = (10 + 5) / 10 = 1,5.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur la première
 * assertion centrale — « champ « date d'état » absent du rapport ». */

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

async function lier(page, barreSuccesseur, nomPredecesseur) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('#taskModalOverlay .form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    const ligne = groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption('FS');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

test('la date d\'état et l\'échéance du projet se saisissent dans le rapport DCMA et persistent', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E DCMADates ${suffixe}`;
    const nomA = `Terrassement ${suffixe}`;
    const nomB = `Fondations ${suffixe}`;
    const nomC = `Elevation ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, nomProjet);
    await creerTache(page, nomA, '2026-06-01', '2026-06-05');
    const barreB = await creerTache(page, nomB, '2026-06-08', '2026-06-12');
    const barreC = await creerTache(page, nomC, '2026-06-15', '2026-06-19');
    await lier(page, barreB, nomA);
    await lier(page, barreC, nomB);

    await page.locator('#dcmaBtn').click();
    const modale = page.locator('#dcmaReportModal');
    const ligne = (n) => modale.locator(`tr[data-dcma-point="${n}"]`);

    /* DISCRIMINANT — LE RAPPORT PART DE L'ÉTAT SANS CHAMPS. Le planning est
       celui qu'on croit (3 tâches, 2 liens), la date d'état est celle du
       jour, et la marge négative n'est pas mesurable. Sans ce point, les
       valeurs lues après saisie pourraient ne rien devoir aux champs.
       Passe avant comme après. */
    await expect(modale.locator('.dcma-perimetre')).toHaveText('3 tâche(s) incomplète(s), 2 lien(s)');
    await expect(modale.locator('.dcma-date-etat')).toContainText('(aujourd\'hui)');
    await expect(ligne(7)).toHaveAttribute('data-etat', 'na');

    /* --- L'ASSERTION CENTRALE, 1/2 : les champs existent et pilotent le
       rapport. */
    const champDate = modale.locator('#dcmaDateEtat');
    const champEcheance = modale.locator('#dcmaEcheance');
    await expect(champDate, 'champ « date d\'état » absent du rapport').toBeVisible();
    await expect(champEcheance, 'champ « échéance » absent du rapport').toBeVisible();
    await champDate.fill('2026-06-08');
    await champEcheance.fill('2026-06-26');

    await expect(modale.locator('.dcma-date-etat')).toHaveText('8 juin 2026');
    await expect(modale.locator('.dcma-echeance')).toHaveText('26 juin 2026');
    await expect(ligne(7)).toHaveAttribute('data-etat', 'ok');
    await expect(ligne(7).locator('.dcma-valeur')).toHaveText('0 % (0/3)');
    await expect(ligne(9).locator('.dcma-valeur')).toHaveText('1');
    await expect(ligne(13)).toHaveAttribute('data-etat', 'ok');
    await expect(ligne(13).locator('.dcma-valeur')).toHaveText('1,5');

    /* --- L'ASSERTION CENTRALE, 2/2 : ils survivent au rechargement. Le
       rapport n'a affiché ses valeurs qu'après l'écriture (attendue avant
       le recalcul) : recharger maintenant relit la base. */
    await page.keyboard.press('Escape');
    await expect(modale).toHaveCount(0);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('#dcmaBtn').click();
    await expect(modale.locator('#dcmaDateEtat'), 'date d\'état relue après rechargement').toHaveValue('2026-06-08');
    await expect(modale.locator('#dcmaEcheance'), 'échéance relue après rechargement').toHaveValue('2026-06-26');
    await expect(ligne(13).locator('.dcma-valeur')).toHaveText('1,5');

    await page.keyboard.press('Escape');
    await expect(modale).toHaveCount(0);
    await deleteActiveProject(page);
});
