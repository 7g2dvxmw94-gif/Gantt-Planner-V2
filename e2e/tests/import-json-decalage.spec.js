import { test, expect } from '../fixtures.js';
import { readFileSync } from 'fs';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G1 étape 5 (réimport d'un export JSON) sous
 * l'angle des LIENS : un lien porte un type ET un décalage (§ B7).
 *
 * LE DÉFAUT : les deux points d'entrée de l'import JSON reconstruisent
 * chaque lien sans son décalage. store.importProject() comme
 * store.importAllProjects() écrivent
 *
 *     return { taskId: idMap[d.taskId] || d.taskId, type: d.type || 'FS' };
 *
 * — `lag` n'est pas recopié. L'export, lui, le contient : les tâches y sont
 * sérialisées telles quelles. Un aller-retour export → import efface donc
 * toutes les avances et tous les retards des liens, et la copie importée se
 * replanifie autrement que l'original, sans que rien ne le signale.
 *
 * CE N'EST PAS UNE LIMITE DOCUMENTÉE. L'import et l'export MS Project
 * forcent le décalage à 0 et le disent dans un commentaire ; l'import
 * JSON, format natif de l'application, ne dit rien et n'a aucune raison
 * de le perdre.
 *
 * POURQUOI MAINTENANT. Le futur contrôle DCMA compte les avances (point 2)
 * et les retards (point 3) des liens : sur un projet réimporté, il
 * afficherait un faux vert.
 *
 * DEUX TESTS, UN PAR POINT D'ENTRÉE, même défaut et même correctif. Le
 * rouge attendu est DEUX échecs, chacun sur son assertion centrale, avec
 * le message « décalage relu après réimport : 0 ».
 *
 * LE DÉCALAGE EST NÉGATIF (−2, une avance) : c'est le cas le plus exposé —
 * une valeur absente se relit 0, et un correctif qui perdrait le signe se
 * verrait aussi. */

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

/** La ligne du prédécesseur dans « Précédée par », modale ouverte. Le
 *  <select> et le champ de décalage ne sont visibles que case cochée. */
function lignePredecesseur(page, nomPredecesseur) {
    const groupe = page.locator('#taskModalOverlay .form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    return groupe.locator('.dep-list > div').filter({ hasText: nomPredecesseur });
}

async function lier(page, barreSuccesseur, nomPredecesseur, type, decalage) {
    await barreSuccesseur.dblclick();
    const ligne = lignePredecesseur(page, nomPredecesseur);
    await ligne.locator('input[type="checkbox"]').check();
    await ligne.locator('select').selectOption(type);
    await ligne.locator('input[type="number"]').fill(String(decalage));
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

/** Ouvre la tâche, relit son lien vers le prédécesseur, referme sans
 *  enregistrer. */
async function relireLien(page, barre, nomPredecesseur) {
    await barre.dblclick();
    const ligne = lignePredecesseur(page, nomPredecesseur);
    await expect(ligne).toHaveCount(1);
    const lien = {
        coche: await ligne.locator('input[type="checkbox"]').isChecked(),
        type: await ligne.locator('select').inputValue(),
        decalage: await ligne.locator('input[type="number"]').inputValue(),
    };
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    return lien;
}

async function exporter(page, libelle) {
    await page.locator('#exportBtn').click();
    const telechargement = page.waitForEvent('download');
    await page.locator('.export-dropdown-item')
        .filter({ has: page.locator('.export-dropdown-label', { hasText: libelle }) })
        .click();
    return JSON.parse(readFileSync(await (await telechargement).path(), 'utf-8'));
}

/** Nom de fichier explicite avec l'extension : _importProject() trie par
 *  extension, et download.path() n'en a pas (leçon de import-json.spec.js). */
async function importer(page, donnees, nomFichier) {
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    await (await selecteur).setFiles({
        name: nomFichier,
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
}

/** Les mêmes étapes pour les deux points d'entrée, jusqu'à l'export. */
async function preparer(page, suffixe, prefixe) {
    const noms = {
        projet: `E2E ${prefixe} ${suffixe}`,
        a: `Fondations ${suffixe}`,
        b: `Elevation ${suffixe}`,
    };
    await page.goto('index.html');
    await createProject(page, noms.projet);
    const idOriginal = await trackActiveProject(page);

    await creerTache(page, noms.a, '2026-06-01', '2026-06-05');
    const barreB = await creerTache(page, noms.b, '2026-06-08', '2026-06-10');
    await lier(page, barreB, noms.a, 'FS', -2);

    /* DISCRIMINANT 1 — LA MODALE A PRIS LE DÉCALAGE TEL QUEL.
       Avant tout export, le lien de l'original porte bien −2. Sans ce
       point, un 0 relu après réimport pourrait venir de la saisie, pas de
       l'import. Passe avant comme après. */
    expect(await relireLien(page, barreB, noms.a),
        'original, avant export : lien FS −2').toEqual({ coche: true, type: 'FS', decalage: '-2' });

    return { noms, idOriginal };
}

/** Les mêmes étapes pour les deux points d'entrée, après l'import. */
async function verifierCopie(page, noms, idOriginal) {
    /* La copie importée devient le projet actif ; le filet de nettoyage ne
       la connaît pas, elle ne vient pas de createProject(). */
    const idCopie = await trackActiveProject(page);

    /* Le rechargement fait relire la base : le décalage doit être persisté,
       pas seulement présent en mémoire. */
    await page.reload();
    await waitForAppReady(page);

    /* DISCRIMINANT 3 — C'EST BIEN LA COPIE QUI EST AFFICHÉE.
       L'original porte le même nom et, lui, a gardé son décalage : s'il
       était le projet actif, l'assertion centrale passerait sans rien dire
       de l'import. Passe avant comme après. */
    const idActif = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.id ?? null;
    });
    expect(idCopie, 'la copie doit être un autre projet que l\'original').not.toBe(idOriginal);
    expect(idActif, 'après rechargement, le projet actif doit être la copie').toBe(idCopie);

    const barreB = page.locator('.gantt-bar[data-task-id]').filter({ hasText: noms.b });
    await expect(barreB).toBeVisible({ timeout: 10_000 });
    const lien = await relireLien(page, barreB, noms.a);

    /* DISCRIMINANT 4 — LE LIEN LUI-MÊME A SURVÉCU, AVEC SON TYPE.
       Si l'import perdait le lien entier, l'assertion centrale échouerait
       aussi, mais pour une autre raison que celle qu'on mesure. Passe
       avant comme après. */
    expect({ coche: lien.coche, type: lien.type }, 'copie : le lien FS doit exister').toEqual({ coche: true, type: 'FS' });

    /* --- L'ASSERTION CENTRALE ---
       Le décalage a traversé l'aller-retour. Tant que le défaut tient, le
       message dira 0 : la valeur par défaut d'un lag absent. */
    expect(lien.decalage, `décalage relu après réimport : ${lien.decalage}`).toBe('-2');

    // Nettoyage : la copie (active), puis l'original (même nom).
    await deleteActiveProject(page);
    await page.reload();
    await waitForAppReady(page);
    await page.locator('.project-selector').click();
    await page.locator('.project-dropdown-item .project-item-name', { hasText: noms.projet }).first().click();
    await deleteActiveProject(page);
}

test('réimporter un export JSON conserve le décalage des liens', async ({ page }) => {
    const { noms, idOriginal } = await preparer(page, Date.now(), 'ImportLag');

    const exportProjet = await exporter(page, /^JSON$/);

    /* DISCRIMINANT 2 — L'EXPORT CONTIENT LE DÉCALAGE.
       Ferme l'explication concurrente « c'est l'export qui le perd ». Passe
       avant comme après. */
    const tacheB = exportProjet.tasks.find(t => t.name === noms.b);
    const tacheA = exportProjet.tasks.find(t => t.name === noms.a);
    expect(tacheB.dependencies, 'export : le lien de B vers A, avec son décalage')
        .toEqual([{ taskId: tacheA.id, type: 'FS', lag: -2 }]);

    await importer(page, exportProjet, 'export.json');
    await expect(page.locator('#toastContainer .toast', { hasText: `"${noms.projet}"` }))
        .toBeVisible({ timeout: 10_000 });

    await verifierCopie(page, noms, idOriginal);
});

/* Second point d'entrée : « Tout exporter » produit une sauvegarde
 * `type: 'full-backup'`, que le même bouton route vers
 * store.importAllProjects(). La sauvegarde est réduite au seul projet du
 * test avant réimport, et sa personnalisation vidée : importAllProjects()
 * ne renomme pas les copies et fusionne la personnalisation dans les
 * réglages du compte partagé (même précaution que import-json.spec.js). */
test('restaurer une sauvegarde globale conserve le décalage des liens', async ({ page }) => {
    const { noms, idOriginal } = await preparer(page, Date.now(), 'BackupLag');

    const sauvegarde = await exporter(page, /^Tout exporter$/);
    expect(sauvegarde.type).toBe('full-backup');
    const projet = sauvegarde.projects.find(p => p.name === noms.projet);
    expect(projet, 'le projet du test doit figurer dans la sauvegarde').toBeTruthy();
    const taches = sauvegarde.tasks.filter(t => t.projectId === projet.id);

    /* DISCRIMINANT 2 — LA SAUVEGARDE CONTIENT LE DÉCALAGE. Passe avant
       comme après. */
    const tacheB = taches.find(t => t.name === noms.b);
    const tacheA = taches.find(t => t.name === noms.a);
    expect(tacheB.dependencies, 'sauvegarde : le lien de B vers A, avec son décalage')
        .toEqual([{ taskId: tacheA.id, type: 'FS', lag: -2 }]);

    await importer(page, {
        ...sauvegarde,
        projects: [projet],
        tasks: taches,
        resources: [],
        customization: {},
    }, 'sauvegarde.json');
    await expect(page.locator('#toastContainer .toast', { hasText: 'projet(s) importé(s)' }))
        .toBeVisible({ timeout: 10_000 });

    await verifierCopie(page, noms, idOriginal);
});
