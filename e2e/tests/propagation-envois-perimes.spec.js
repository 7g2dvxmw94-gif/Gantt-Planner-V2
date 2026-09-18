import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Couvre TEST_PLAN.md § B3 (dépendances), sur la face RÉSEAU du losange
 * traité en #68.
 *
 * LE DÉFAUT : la propagation envoie au serveur les valeurs
 * INTERMÉDIAIRES, pas seulement la valeur finale.
 *
 *     succ.startDate = cible.startDate;
 *     succ.endDate   = cible.endDate;
 *     …
 *     supabaseStore.upsertTask(succ)          // envoi A CHAQUE deplacement
 *         .catch(…);
 *     this.propagateDependencies(succ.id, enCours);
 *
 * Or `upsertTask` fige la ligne AU MOMENT DE L'APPEL — `taskToRow(task)`
 * est synchrone et s'exécute avant le premier `await`. La requête part
 * donc avec la valeur du moment, périmée si la tâche est redéplacée
 * ensuite.
 *
 * Dans un losange, une jonction est recalculée une fois par branche :
 *
 *         ┌─> B (1 j) ─┐
 *     A ──┤            ├─> D (1 j) ──> E (1 j)
 *         └─> C (3 j) ─┘
 *
 * Mesuré hors navigateur sur le texte réel de store.js :
 *
 *     1. B=2026-06-10   2. D=2026-06-11   3. E=2026-06-12
 *     4. C=2026-06-10   5. D=2026-06-15   6. E=2026-06-16
 *
 * D et E partent DEUX FOIS, la première avec une date périmée.
 *
 * LA CONSÉQUENCE EST UNE COURSE, ET ELLE PORTE SUR LES DONNÉES. Deux
 * requêtes HTTP indépendantes écrivent la même ligne. Rien ne garantit
 * leur ordre d'arrivée : si la périmée passe en second, la base conserve
 * une date fausse pendant que l'écran affiche la bonne, et le prochain
 * chargement ramène le planning erroné.
 *
 * D'OÙ CELA VIENT, ET IL FAUT LE DIRE. Avant #68, E n'était envoyée
 * qu'une fois, avec la valeur fausse : la corruption était déterministe.
 * #68 a corrigé le calcul et transformé cette corruption en course. Le
 * progrès est net, le résidu n'en est pas moins réel.
 *
 * CE TEST NE PROVOQUE PAS LA COURSE — il ne le pourrait pas de façon
 * déterministe, et un test qui dépend d'un ordre d'arrivée serait
 * instable par construction. Il constate la cause, qui est déterministe :
 * une date périmée QUITTE le navigateur. Tant qu'aucune ne part, aucun
 * ordre d'arrivée ne peut nuire.
 *
 * C'est donc un test de trafic réseau plutôt que d'interface, ce qui est
 * inhabituel ici et mérite d'être dit. La contrepartie est un risque
 * précis : si l'interception ne capturait rien, le test passerait sans
 * rien mesurer. Le discriminant ferme cette porte.
 *
 * JUIN 2026 COMMENCE UN LUNDI.
 */

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

async function lier(page, barreSuccesseur, nomsPredecesseurs) {
    await barreSuccesseur.dblclick();
    const groupe = page.locator('.form-group',
        { has: page.locator('.form-label', { hasText: 'Précédée par' }) });
    for (const nom of nomsPredecesseurs) {
        await groupe.locator('.dep-list > div').filter({ hasText: nom })
            .locator('input[type="checkbox"]').check();
    }
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
}

/** Attend que le trafic se taise : aucune nouvelle écriture pendant
 *  1,5 s. Plus fiable qu'une attente fixe — la propagation tire ses
 *  requêtes sans les attendre, et leur nombre dépend du graphe. */
async function attendreSilenceReseau(page, envois) {
    const debut = Date.now();
    let dernier = -1, depuis = Date.now();
    while (Date.now() - debut < 20_000) {
        if (envois.length !== dernier) { dernier = envois.length; depuis = Date.now(); }
        else if (Date.now() - depuis > 1_500) return;
        await page.waitForTimeout(250);
    }
}

test('la propagation n\'envoie jamais une date périmée au serveur', async ({ page }) => {
    const suffixe = Date.now();
    const nomA = `Amont ${suffixe}`;
    const nomB = `Branche courte ${suffixe}`;
    const nomC = `Branche longue ${suffixe}`;
    const nomD = `Jonction ${suffixe}`;
    const nomE = `Finition ${suffixe}`;

    await page.goto('index.html');
    await createProject(page, `E2E EnvoisPerimes ${suffixe}`);

    const barreA = await creerTache(page, nomA, '2026-06-01', '2026-06-02');
    // B avant C : l'ordre de création décide de l'ordre de propagation.
    const barreB = await creerTache(page, nomB, '2026-06-22', '2026-06-22');
    const barreC = await creerTache(page, nomC, '2026-06-22', '2026-06-24');
    const barreD = await creerTache(page, nomD, '2026-06-22', '2026-06-22');
    const barreE = await creerTache(page, nomE, '2026-06-22', '2026-06-22');

    await lier(page, barreB, [nomA]);
    await lier(page, barreC, [nomA]);
    await lier(page, barreD, [nomB, nomC]);
    await lier(page, barreE, [nomD]);

    /* Le nom est plus parlant qu'un UUID dans un message d'échec. */
    const nomParId = {};
    for (const [barre, nom] of [[barreA, nomA], [barreB, nomB], [barreC, nomC],
                                [barreD, nomD], [barreE, nomE]]) {
        nomParId[await barre.getAttribute('data-task-id')] = nom.split(' ')[0];
    }
    const idD = Object.keys(nomParId).find(id => nomParId[id] === 'Jonction');

    /* L'écoute ne commence QU'ICI : les créations et les liaisons ont
       elles aussi écrit en base, et leurs envois n'ont rien à voir avec
       ce que ce test mesure. */
    const envois = [];
    page.on('request', (req) => {
        if (!req.url().includes('/rest/v1/tasks')) return;
        if (req.method() !== 'POST' && req.method() !== 'PATCH') return;
        let corps;
        try { corps = JSON.parse(req.postData() || 'null'); } catch { return; }
        for (const ligne of (Array.isArray(corps) ? corps : [corps])) {
            if (ligne && ligne.id) envois.push({ id: ligne.id, debut: ligne.start_date });
        }
    });

    // L'utilisateur repousse A d'une semaine : la cascade part.
    await barreA.dblclick();
    await page.locator('#taskStart').fill('2026-06-08');
    await page.locator('#taskEnd').fill('2026-06-09');
    await page.locator('#taskModalOverlay').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });

    await attendreSilenceReseau(page, envois);

    /* DISCRIMINANT — L'INTERCEPTION A BIEN VU PASSER LA CASCADE.
       C'est la seule façon dont ce test pourrait mentir : ne rien capter
       et conclure « aucune date périmée envoyée ». Exiger que la
       JONCTION du losange ait été écrite établit que la propagation a
       atteint le fond du montage ET que l'écoute fonctionne — sans rien
       préjuger du nombre d'envois, que l'assertion centrale tranche. */
    expect(envois.map(e => e.id)).toContain(idD);

    /* --- L'ASSERTION CENTRALE ---
       Une tâche écrite deux fois avec deux dates différentes signifie
       qu'une valeur périmée est partie sur le réseau. La liste plutôt
       qu'un booléen : l'échec nomme alors les tâches et leurs valeurs
       successives. */
    const valeursParTache = {};
    for (const { id, debut } of envois) (valeursParTache[id] ??= new Set()).add(debut);
    const perimees = Object.entries(valeursParTache)
        .filter(([, valeurs]) => valeurs.size > 1)
        .map(([id, valeurs]) => `${nomParId[id] || id} : ${[...valeurs].join(' puis ')}`)
        .sort();
    expect(perimees).toEqual([]);

    await deleteActiveProject(page);
});
