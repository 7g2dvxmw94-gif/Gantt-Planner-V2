import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § B7 (liens entre tâches), sous l'angle de la
 * SAISIE dans un grand planning.
 *
 * LE BESOIN : la fiche d'une tâche ou d'un jalon liste, sous « Précédée
 * par » et « Succédée par », TOUTES les autres tâches du projet, chacune
 * avec sa case — sans aucun moyen de filtrer. Sur un planning de mille
 * lignes, trouver le prédécesseur voulu revient à faire défiler mille
 * cases dans une boîte de 120 pixels de haut. La demande : un champ de
 * recherche au-dessus de chacune des deux listes.
 *
 * CE QUE LE CHAMP DOIT FAIRE, et que ce fichier vérifie :
 *   - filtrer sur le nom sans tenir compte ni de la casse ni des accents :
 *     un planificateur tape « ecran », pas « Écran », et « oeuvre », pas
 *     « œuvre » ;
 *   - accepter plusieurs mots, dans n'importe quel ordre ;
 *   - ne JAMAIS masquer une ligne cochée : un lien existant ne doit pas
 *     disparaître de la vue parce qu'il ne correspond pas à la recherche,
 *     et les liens existants sont regroupés en tête de liste ;
 *   - dire combien de tâches correspondent, ou qu'aucune ne correspond ;
 *   - ne rien changer à ce qui est enregistré : cocher une ligne trouvée
 *     crée le lien, et les liens existants gardent leur type et leur
 *     décalage ;
 *   - Échap dans le champ vide la recherche SANS fermer la fiche — la
 *     fiche se ferme sur Échap sans rien enregistrer ni demander.
 *
 * LE JEU : trente tâches de chantier et de permis de construire, importées
 * d'un coup par le JSON natif de l'application (store.importProject), dont
 * des noms accentués en tête (« Écran acoustique ») et au milieu (« Pose
 * écran sous-toiture »). Deux liens y sont posés : Plâtrerie suit
 * Électricité (Début→Début, +2 j), Levée des réserves suit Réception des
 * travaux (Fin→Début, +3 j). Tous les noms portent le suffixe du test.
 *
 * LE COMPTE EST PARTAGÉ. Le projet porte un nom suffixé, est enregistré
 * auprès du filet de nettoyage dès qu'il devient actif, et supprimé à la
 * fin. Les listes sont comparées par NOMS, jamais comptées en bloc. Le zoom
 * n'intervient pas : la fiche s'ouvre par un double-clic sur le nom, dans
 * la colonne de gauche du Gantt, présente à tous les zooms. La vue active
 * n'est pas changée.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : DEUX échecs, un par test,
 * chacun sur l'assertion de présence du champ — « champ de recherche absent
 * de « Précédée par » » et « champ de recherche absent de « Succédée
 * par » ». Les discriminants qui la précèdent passent. */

const FICHE = '#taskModalOverlay';

/** Les trente noms, dans l'ordre du planning. */
const NOMS = [
    'Étude de sol',
    'Dépôt du permis de construire',
    'Instruction du permis',
    'Affichage du permis sur le terrain',
    'Purge du recours des tiers',
    'Démolition',
    'Désamiantage',
    'Terrassement',
    'Fondations',
    'Gros œuvre – élévation',
    'Coulage dalle R+1',
    'Charpente',
    'Couverture',
    'Pose écran sous-toiture',
    'Étanchéité terrasse',
    'Menuiseries extérieures',
    'Façade – ravalement',
    'Écran acoustique',
    'Électricité courants forts',
    'Plomberie',
    'Chauffage – ventilation',
    'Plâtrerie – isolation',
    'Carrelage',
    'Peinture',
    'VRD',
    'Espaces verts',
    'Réception des travaux',
    'Levée des réserves',
    'Garantie de parfait achèvement',
    'DAACT – déclaration d\'achèvement',
];
const JALONS = ['Réception des travaux'];
/** Liens du jeu : [successeur, prédécesseur, type, décalage]. */
const LIENS = [
    ['Plâtrerie – isolation', 'Électricité courants forts', 'SS', 2],
    ['Levée des réserves', 'Réception des travaux', 'FS', 3],
];

/** Nom complet (suffixé) d'un nom de base. */
const nommer = (suffixe) => (base) => `${base} ${suffixe}`;

/** Le fichier JSON importé : la forme d'un export (projet + tâches). Une
 *  tâche par semaine à partir du lundi 7 septembre 2026, du lundi au
 *  vendredi ; le jalon tombe le vendredi. */
function jeu(suffixe) {
    const nom = nommer(suffixe);
    const id = (base) => `jeu-${NOMS.indexOf(base)}`;
    const iso = (jours) => {
        const d = new Date(Date.UTC(2026, 8, 7 + jours));
        return d.toISOString().slice(0, 10);
    };
    return {
        project: { id: 'jeu-projet', name: `E2E RechercheLiens ${suffixe}`, description: '' },
        tasks: NOMS.map((base, i) => {
            const jalon = JALONS.includes(base);
            return {
                id: id(base),
                name: nom(base),
                description: '',
                startDate: iso(7 * i + (jalon ? 4 : 0)),
                endDate: iso(7 * i + 4),
                progress: 0,
                priority: 'medium',
                status: 'todo',
                color: '#6366F1',
                order: i,
                parentId: null,
                isMilestone: jalon,
                isPhase: false,
                isPermit: false,
                assignees: [],
                dependencies: LIENS.filter(([succ]) => succ === base)
                    .map(([, pred, type, lag]) => ({ taskId: id(pred), type, lag })),
            };
        }),
        resources: [],
    };
}

/** Nom du projet actif, lu dans le store de la page. */
async function projetActif(page) {
    return page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.name ?? null;
    });
}

/** Importe le jeu par le bouton « Importer », comme un utilisateur. Renvoie
 *  la fonction qui donne le nom complet d'un nom de base. */
async function preparer(page, suffixe) {
    const donnees = jeu(suffixe);
    await page.goto('index.html');
    await waitForAppReady(page);
    const selecteur = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    /* Nom de fichier explicite avec l'extension : _importProject() trie par
       extension (leçon de import-json.spec.js). */
    await (await selecteur).setFiles({
        name: 'jeu.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(donnees)),
    });
    /* Le projet devient actif AVANT les écritures en base : il est confié
       au filet de nettoyage dès ce moment, pour qu'un import qui
       échouerait ensuite ne laisse pas sa ligne sur le compte partagé. */
    await expect.poll(() => projetActif(page), {
        message: 'le projet importé doit devenir le projet actif', timeout: 15_000,
    }).toBe(donnees.project.name);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: `"${donnees.project.name}"` }),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });
    return nommer(suffixe);
}

/** Ouvre la fiche d'une tâche par un double-clic sur son nom, dans la
 *  colonne de gauche du Gantt. */
async function ouvrirFiche(page, nom) {
    const cellule = page.locator(`.gantt-row .task-name[title="${nom}"]`);
    await expect(cellule, `« ${nom} » doit figurer dans le Gantt`).toBeVisible({ timeout: 10_000 });
    await cellule.dblclick();
    await expect(page.locator(FICHE), 'le double-clic sur le nom doit ouvrir la fiche').toBeVisible({ timeout: 10_000 });
    /* DISCRIMINANT — C'EST BIEN LA FICHE DE CETTE TÂCHE. Sans lui, une
       liste inattendue pourrait venir d'une autre fiche. Passe avant comme
       après. */
    await expect(page.locator('#taskName'), 'la fiche ouverte doit être celle de la tâche visée')
        .toHaveValue(nom);
}

/** Le groupe « Précédée par » ou « Succédée par » de la fiche ouverte. */
function groupe(page, libelle) {
    return page.locator(`${FICHE} .form-group`, { has: page.locator('.form-label', { hasText: libelle }) });
}

/** La ligne d'une tâche dans une liste de liens. */
function ligne(grp, nom) {
    return grp.locator('.dep-list > div').filter({ hasText: nom });
}

/** Noms des lignes AFFICHÉES d'une liste de liens, dans l'ordre de la
 *  liste. Une ligne masquée par le filtre n'y figure pas ; une ligne
 *  seulement sortie du cadre par le défilement, si. */
async function nomsAffiches(grp) {
    return grp.locator('.dep-list > div').evaluateAll(lignes => lignes
        .filter(l => l.checkVisibility())
        .map(l => l.querySelector(':scope > span:not(:empty)')?.textContent ?? ''));
}

const trie = (noms) => [...noms].sort();

/** Les liens enregistrés de chaque tâche nommée, relus dans le store, par
 *  nom de tâche liée. */
async function liensEnregistres(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const nomDe = new Map(taches.map(t => [t.id, t.name]));
        return Object.fromEntries(noms.map(n => {
            const tache = taches.find(t => t.name === n);
            const liens = (tache?.dependencies || [])
                .map(d => ({ nom: nomDe.get(d.taskId) ?? d.taskId, type: d.type, lag: d.lag }))
                .sort((a, b) => (a.nom < b.nom ? -1 : 1));
            return [n, tache ? liens : null];
        }));
    }, noms);
}

test('la fiche d\'une tâche filtre ses prédécesseurs par une recherche sans casse ni accents', async ({ page }) => {
    const nom = await preparer(page, Date.now());
    const editee = nom('Plâtrerie – isolation');
    const existant = nom('Électricité courants forts');
    const cible = nom('Pose écran sous-toiture');
    const autreTrouvee = nom('Écran acoustique');
    const autres = NOMS.map(nom).filter(n => n !== editee);

    await ouvrirFiche(page, editee);
    const grp = groupe(page, 'Précédée par');

    /* DISCRIMINANT 1 — AVANT TOUTE FRAPPE, LA LISTE PROPOSE LES 29 AUTRES
       TÂCHES. Ferme « la liste était déjà courte » : sans lui, une liste
       réduite à trois lignes par le jeu lui-même passerait l'assertion
       centrale sans que rien n'ait été filtré. Passe avant comme après. */
    expect(trie(await nomsAffiches(grp)), 'avant toute frappe, « Précédée par » doit proposer les 29 autres tâches')
        .toEqual(trie(autres));

    /* DISCRIMINANT 2 — LE LIEN IMPORTÉ EST COCHÉ, AVEC SON TYPE ET SON
       DÉCALAGE ; LA TÂCHE CHERCHÉE EST DANS LA LISTE NON FILTRÉE, DÉCOCHÉE.
       Ferme « l'import n'a pas posé le lien » (la ligne cochée qui doit
       rester affichée ne le serait pas) et « la tâche cherchée manquait
       déjà ». Passe avant comme après. */
    const lExistant = ligne(grp, existant);
    await expect(lExistant, `une seule ligne « ${existant} »`).toHaveCount(1);
    await expect(lExistant.locator('input[type="checkbox"]'), 'le lien importé doit être coché').toBeChecked();
    await expect(lExistant.locator('select'), 'le lien importé est un Début→Début').toHaveValue('SS');
    await expect(lExistant.locator('input[type="number"]'), 'le lien importé porte +2 j').toHaveValue('2');
    const lCible = ligne(grp, cible);
    await expect(lCible, `la tâche cherchée doit être dans la liste non filtrée`).toHaveCount(1);
    await expect(lCible.locator('input[type="checkbox"]')).not.toBeChecked();

    // --- PRÉSENCE DU CHAMP, avant toute frappe.
    const champ = grp.getByRole('searchbox');
    await expect(champ, 'champ de recherche absent de « Précédée par »').toHaveCount(1);
    await expect(champ).toHaveAccessibleName('Rechercher un prédécesseur');
    await expect(champ).toHaveValue('');

    /* --- L'ASSERTION CENTRALE, 1/2 : LE FILTRE.
       « oeuvre » trouve « Gros œuvre – élévation » : la ligature œ ne se
       décompose pas comme un accent, elle doit être dépliée.
       Puis « ecran », sans majuscule ni accent, trouve « Écran acoustique »
       (majuscule accentuée en tête) et « Pose écran sous-toiture » (accent
       au milieu). Dans les deux cas, la ligne cochée, qui ne correspond
       pas, reste affichée, en tête. */
    await champ.fill('oeuvre');
    await expect.poll(async () => trie(await nomsAffiches(grp)), {
        message: '« oeuvre » : seules « Gros œuvre » et la ligne cochée restent affichées',
    }).toEqual(trie([existant, nom('Gros œuvre – élévation')]));
    await champ.fill('ecran');
    await expect.poll(async () => trie(await nomsAffiches(grp)), {
        message: '« ecran » : seules les deux tâches trouvées et la ligne cochée restent affichées',
    }).toEqual(trie([existant, cible, autreTrouvee]));
    expect((await nomsAffiches(grp))[0], 'le lien existant doit être en tête de liste').toBe(existant);
    await expect(grp.getByRole('status'), 'le compte des tâches trouvées').toHaveText('Résultats : 2 sur 29');

    await lCible.locator('input[type="checkbox"]').check();
    await page.locator(FICHE).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator(FICHE)).toBeHidden({ timeout: 15_000 });

    /* --- L'ASSERTION CENTRALE, 2/2 : CE QUI EST ENREGISTRÉ.
       Le lien coché depuis la liste filtrée est créé, avec le type et le
       décalage par défaut ; le lien existant garde les siens. */
    expect((await liensEnregistres(page, [editee]))[editee], 'liens enregistrés de la tâche éditée').toEqual([
        { nom: existant, type: 'SS', lag: 2 },
        { nom: cible, type: 'FS', lag: 0 },
    ].sort((a, b) => (a.nom < b.nom ? -1 : 1)));

    await deleteActiveProject(page);
});

test('la fiche d\'un jalon filtre ses successeurs, et Échap vide la recherche sans fermer la fiche', async ({ page }) => {
    const nom = await preparer(page, Date.now());
    const editee = nom('Réception des travaux');
    const existant = nom('Levée des réserves');
    const cible = nom('DAACT – déclaration d\'achèvement');
    const voisine = nom('Garantie de parfait achèvement');
    const autres = NOMS.map(nom).filter(n => n !== editee);

    await ouvrirFiche(page, editee);
    const grp = groupe(page, 'Succédée par');

    /* DISCRIMINANT 1 — AVANT TOUTE FRAPPE, LA LISTE PROPOSE LES 29 AUTRES
       TÂCHES. Même rôle que dans le premier test. Passe avant comme
       après. */
    expect(trie(await nomsAffiches(grp)), 'avant toute frappe, « Succédée par » doit proposer les 29 autres tâches')
        .toEqual(trie(autres));

    /* DISCRIMINANT 2 — LE SUCCESSEUR IMPORTÉ EST COCHÉ ; LA TÂCHE CHERCHÉE
       EST DANS LA LISTE NON FILTRÉE, DÉCOCHÉE. Passe avant comme après. */
    const lExistant = ligne(grp, existant);
    await expect(lExistant, `une seule ligne « ${existant} »`).toHaveCount(1);
    await expect(lExistant.locator('input[type="checkbox"]'), 'le successeur importé doit être coché').toBeChecked();
    await expect(lExistant.locator('select'), 'le lien importé est un Fin→Début').toHaveValue('FS');
    const lCible = ligne(grp, cible);
    await expect(lCible, 'la tâche cherchée doit être dans la liste non filtrée').toHaveCount(1);
    await expect(lCible.locator('input[type="checkbox"]')).not.toBeChecked();

    // --- PRÉSENCE DU CHAMP, avant toute frappe.
    const champ = grp.getByRole('searchbox');
    await expect(champ, 'champ de recherche absent de « Succédée par »').toHaveCount(1);
    await expect(champ).toHaveAccessibleName('Rechercher un successeur');

    /* Les successeurs existants sont regroupés en tête, comme les
       prédécesseurs. La Levée des réserves vient en 27e position sur 29
       dans l'ordre du planning : sans regroupement, la première ligne
       serait l'Étude de sol. Placé APRÈS la présence du champ : avant le
       correctif, le rouge doit tomber sur le champ absent, pas sur
       l'ordre. */
    expect((await nomsAffiches(grp))[0], 'le successeur existant doit être en tête de liste').toBe(existant);

    /* Aucune tâche ne correspond : seule la ligne cochée reste, et la fiche
       le dit. */
    await champ.fill('ascenseur');
    await expect.poll(async () => await nomsAffiches(grp), {
        message: '« ascenseur » : seule la ligne cochée reste affichée',
    }).toEqual([existant]);
    await expect(grp.getByRole('status')).toHaveText('Aucune tâche ne correspond à « ascenseur »');

    /* Le filtre lit le NOM seul. Chaque ligne porte aussi la liste des
       types de lien (« Fin→Début », « Fin→Fin »…) : un filtre qui lirait
       tout le texte de la ligne trouverait « fin » sur les 29 lignes.
       Aucun des trente noms ne contient « fin ». */
    await champ.fill('fin');
    await expect.poll(async () => await nomsAffiches(grp), {
        message: '« fin » : le filtre ne lit que le nom, pas les types de lien de la ligne',
    }).toEqual([existant]);
    await expect(grp.getByRole('status')).toHaveText('Aucune tâche ne correspond à « fin »');

    /* Échap dans le champ vide la recherche et rend toute la liste, SANS
       fermer la fiche. La classe `active` est l'état « ouverte » que la
       fiche lit elle-même : la visibilité ne suffirait pas, la fermeture
       laisse la fiche visible le temps de sa transition. */
    await champ.press('Escape');
    await expect(page.locator(FICHE), 'Échap dans le champ ne doit pas fermer la fiche').toHaveClass(/(^|\s)active(\s|$)/);
    await expect(champ, 'Échap vide la recherche').toHaveValue('');
    expect(trie(await nomsAffiches(grp)), 'recherche vidée : toute la liste revient').toEqual(trie(autres));

    /* --- L'ASSERTION CENTRALE, 1/2 : LE FILTRE, À DEUX MOTS.
       « achevement declaration » — deux mots, dans l'ordre inverse du nom,
       sans accents — trouve la seule DAACT. « Garantie de parfait
       achèvement » ne contient que l'un des deux mots : elle est
       masquée. */
    await champ.fill('achevement declaration');
    await expect.poll(async () => trie(await nomsAffiches(grp)), {
        message: '« achevement declaration » : seules la DAACT et la ligne cochée restent affichées',
    }).toEqual(trie([existant, cible]));
    await expect(ligne(grp, voisine)).toBeHidden();

    await lCible.locator('input[type="checkbox"]').check();
    await page.locator(FICHE).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator(FICHE)).toBeHidden({ timeout: 15_000 });

    /* --- L'ASSERTION CENTRALE, 2/2 : CE QUI EST ENREGISTRÉ.
       La DAACT suit désormais le jalon ; la Levée des réserves garde son
       lien et son décalage de +3 j, que la liste des successeurs n'affiche
       pas ; la Garantie, masquée, n'a rien reçu. */
    expect(await liensEnregistres(page, [cible, existant, voisine]), 'liens enregistrés des successeurs').toEqual({
        [cible]: [{ nom: editee, type: 'FS', lag: 0 }],
        [existant]: [{ nom: editee, type: 'FS', lag: 3 }],
        [voisine]: [],
    });

    await deleteActiveProject(page);
});
