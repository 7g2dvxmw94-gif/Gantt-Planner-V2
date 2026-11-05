import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Le journal du projet — panneau ouvert par #historyBtn — et ce qu'il fait
 * des entrées qu'il affiche.
 *
 * LE DÉFAUT : _showHistoryPanel() (app.js) assemble ses lignes par
 * innerHTML et y interpole, sans les échapper, quatre valeurs tirées de
 * chaque entrée de project_history :
 *
 *     <div …>${initials}</div>              (dérivées de actorName)
 *     <strong>${e.actorName}</strong> ${e.action}
 *     <span …> "${e.entityName}"</span>
 *
 * Ces entrées sont écrites par LES AUTRES MEMBRES du projet. La RPC
 * log_project_history qu'appelle supabaseStore.logHistory() (migration
 * 018) y recopie l'action et le nom de l'entité tels que le client les
 * envoie ; le nom de l'acteur, lui, y est réduit à des initiales par
 * to_initials, et la version de 012 le lit dans le profil (full_name, que
 * chacun choisit). La politique « history: insert if editor » (migration
 * 013) laisse en outre tout éditeur du projet insérer une ligne
 * directement, avec le nom d'acteur qu'il veut.
 * L'action elle-même porte des noms : collaboration-ui.js écrit « a retiré
 * ${m.name} du projet » et « a partagé le projet avec ${email} ». Le nom
 * de l'entité est celui d'une tâche, d'une ressource, d'une baseline ou
 * d'un membre. Faute d'échappement, ce qu'un membre écrit devient du
 * balisage dans la page de tous les autres.
 *
 * LES INITIALES AUSSI. Elles prennent la première lettre de chaque mot du
 * nom, deux au plus : un nom qui commence par un chevron donne « <D », que
 * le navigateur lit comme le début d'une balise. Mesuré au harnais : il
 * crée un élément « d< » qui avale la fermeture de la pastille : le reste
 * de la ligne passe dans la pastille, et les deux lignes suivantes se
 * retrouvent imbriquées dans la première.
 *
 * Comme pour l'export PDF (#48), les vues Coûts (#49), l'infobulle (#50)
 * et le Dashboard (#51), le test n'écrit AUCUNE charge active : des
 * balises inertes, <i> et <b>, suffisent à montrer que le nom n'arrive
 * pas intact.
 *
 * RIEN N'EST LU NI ÉCRIT DANS LE COMPTE PARTAGÉ. Aucune entrée réelle,
 * aucun projet : le test appelle la vraie méthode, sur window.app, avec un
 * journal fabriqué ici. Elle lit l'identifiant du projet actif
 * (store.getSettings()) puis le journal (supabaseStore.getProjectHistory)
 * AVANT son premier await : les deux sont remplacés par des bouchons posés
 * juste avant l'appel et rétablis dans un finally juste après, dans le
 * même bloc synchrone. Aucun autre code de l'application ne peut donc les
 * voir.
 *
 * TROIS ENTRÉES, une par champ balisé — l'acteur (et donc ses initiales),
 * l'action, l'entité —, parce qu'échapper un champ sans les autres
 * laisserait le défaut en place. Leurs noms ordinaires portent aussi une
 * apostrophe, des guillemets et une esperluette, pour qu'un correctif qui
 * échapperait deux fois ne passe pas.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — trois balises, une <b> née du nom de l'acteur et deux <i>
 * nées de l'action et du nom de l'entité, là où il n'en faut aucune. */

const entree = (actorName, action, entityType, entityName) => ({ actorName, action, entityType, entityName });

const JOURNAL_ORDINAIRE = (jeton) => [
    entree("Alice D'Arc", 'a modifié la tâche', 'task', `Coulage dalle ${jeton}`),
    entree('Bruno M.', 'a retiré Chloé R. & fils du projet', 'share', 'Chloé R. & fils'),
    entree('Chloé R.', 'a créé la tâche', 'task', 'Coffrage "voile" d\'angle'),
];
const INITIALES_ORDINAIRES = ['AD', 'BM', 'CR'];

const JOURNAL_BALISE = (jeton) => [
    entree("<b>Alice</b> D'Arc", 'a modifié la tâche', 'task', `Coulage dalle ${jeton}`),
    entree('Bruno M.', 'a retiré <i>Chloé</i> R. & fils du projet', 'share', 'Chloé R. & fils'),
    entree('Chloé R.', 'a créé la tâche', 'task', 'Coffrage <i>voile</i> "B2" d\'angle'),
];
const INITIALES_BALISEES = ['<D', 'BM', 'CR'];

const panneau = (page) => page.locator('#_historyPanel');
const corps = (page) => page.locator('#_historyPanel #_historyBody');
/* Une pastille d'initiales par ligne : premier enfant de chaque ligne,
   elle-même enfant direct du corps. Le titre du jour, sans enfant, n'en
   produit aucune. */
const pastilles = (page) => corps(page).locator(':scope > div > div:first-child');

/* Ouvre le journal avec des entrées fabriquées. Les entrées sont datées
   d'aujourd'hui à midi, heure locale de la page : un seul groupe,
   « Aujourd'hui », et l'heure « 12:00 », quel que soit le fuseau. Rend
   les projets demandés au bouchon du journal, et si les deux bouchons ont
   bien été retirés. */
async function ouvrirJournal(page, entrees, projet) {
    return page.evaluate(async ({ entrees, projet }) => {
        /* Les bouchons sont posés sur les MÊMES instances que celles
           d'app.js : un import par URL relative à la page désigne le module
           déjà chargé (voir cleanup.js), pas une copie. */
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { supabaseStore } = await import(new URL('js/supabase-store.js', base).href);
        const midi = new Date(); midi.setHours(12, 0, 0, 0);
        const journal = entrees.map((e) => ({ ...e, createdAt: midi.toISOString() }));
        const lectures = [];
        const remplacer = (objet, cle, bouchon) => {
            const propre = Object.prototype.hasOwnProperty.call(objet, cle);
            const original = objet[cle];
            objet[cle] = bouchon;
            return () => {
                if (propre) objet[cle] = original; else delete objet[cle];
                return objet[cle] === original;
            };
        };
        const reglages = store.getSettings;
        const retablir = [
            remplacer(store, 'getSettings', () => ({ ...reglages.call(store), activeProjectId: projet })),
            remplacer(supabaseStore, 'getProjectHistory', async (id) => { lectures.push(id); return journal; }),
        ];
        let rendu;
        let retablis;
        try {
            rendu = window.app._showHistoryPanel();
        } finally {
            retablis = retablir.map((f) => f()).every(Boolean);
        }
        await rendu;
        return { lectures, retablis };
    }, { entrees, projet });
}

/* dispatchEvent plutôt que click() : le test ne mesure pas que le bouton
   est cliquable, et un élément de l'application posé par-dessus
   intercepterait le pointeur. */
async function fermer(page) {
    await page.locator('#_historyPanel #_historyClose').dispatchEvent('click');
    await expect(panneau(page)).toHaveCount(0);
}

test('le journal du projet n\'interprète pas comme du balisage les entrées écrites par les autres membres', async ({ page }) => {
    const jeton = String(Date.now());
    const projet = `projet-fictif-historique-${jeton}`;

    await page.goto('index.html');
    await waitForAppReady(page);

    try {
        /* DISCRIMINANT 1 — LES BOUCHONS ONT PRIS, ET ILS SONT RETIRÉS.
           Ferme deux mensonges : un bouchon posé sur une copie du module
           laisserait la méthode lire le vrai journal du compte (ou ne rien
           lire, faute de projet actif), et le test mesurerait d'autres
           entrées que les siennes ; un bouchon resté en place fausserait
           l'application pour la suite. Exactement une lecture, pour le
           projet fictif. Passe avant comme après. */
        const ordinaire = await ouvrirJournal(page, JOURNAL_ORDINAIRE(jeton), projet);
        expect(ordinaire, 'lectures du journal, bouchons retirés').toEqual({ lectures: [projet], retablis: true });

        /* DISCRIMINANT 2 — AVEC DES NOMS ORDINAIRES, LE PANNEAU AFFICHE LES
           TROIS ENTRÉES À L'IDENTIQUE. Ferme « la méthode n'a rien rendu » :
           sans ce point, l'absence de balises plus bas pourrait venir d'un
           panneau vide ou resté sur « Chargement… ». Les pastilles, une par
           entrée, établissent aussi que le sélecteur qui les lit plus bas
           désigne bien les initiales. Et apostrophes, guillemets,
           esperluettes s'affichent tels quels : un correctif qui
           échapperait deux fois, et que l'assertion centrale laisserait
           passer, échoue ici. Passe avant comme après. */
        await expect(panneau(page), 'panneau du journal, noms ordinaires').toBeVisible();
        await expect(pastilles(page), 'initiales, noms ordinaires').toHaveText(INITIALES_ORDINAIRES);
        for (const { actorName, action, entityName } of JOURNAL_ORDINAIRE(jeton)) {
            for (const texte of [actorName, action, `"${entityName}"`]) {
                await expect(corps(page), `journal ordinaire, « ${texte} » à l'identique`).toContainText(texte);
            }
        }
        await expect(corps(page), 'libellé du jour').toContainText("Aujourd'hui");

        /* DISCRIMINANT 3 — LE GABARIT LUI-MÊME NE CONTIENT NI <i> NI <b>.
           Ferme « les balises comptées plus bas viennent du panneau, pas
           des données » : sans ce point, l'assertion centrale pourrait
           échouer sur un correctif juste. Passe avant comme après. */
        await expect(corps(page).locator('i, b'), 'balises du gabarit, sans donnée balisée').toHaveCount(0);

        /* DISCRIMINANT 4 — ✕ FERME LE PANNEAU. Ferme « le second appel a
           refermé le panneau au lieu de l'ouvrir » : la méthode bascule,
           et un panneau resté ouvert ferait du second appel une fermeture.
           Passe avant comme après. */
        await fermer(page);

        const balise = await ouvrirJournal(page, JOURNAL_BALISE(jeton), projet);
        expect(balise, 'lectures du journal balisé, bouchons retirés').toEqual({ lectures: [projet], retablis: true });
        await expect(panneau(page), 'panneau du journal, noms balisés').toBeVisible();

        /* DISCRIMINANT 5 — LE CORPS PORTE LES ENTRÉES BALISÉES, au moins
           dans ce qui survit au défaut : les mots hors balises et ceux
           qu'elles entourent. Ferme « le test ne lit pas le bon élément » :
           un autre panneau, ou un corps sans ces entrées, ne les
           contiendrait pas. Passe avant comme après. */
        for (const fragment of ['Alice', "D'Arc", 'Bruno M.', 'Chloé', 'voile', jeton]) {
            await expect(corps(page), `journal balisé, fragment « ${fragment} »`).toContainText(fragment);
        }

        /* --- L'ASSERTION CENTRALE ---
           Aucune balise ne doit naître des données : ni <b> du nom de
           l'acteur, ni <i> de l'action ou du nom de l'entité. Faute
           d'échappement, le navigateur les crée. */
        await expect(corps(page).locator('i, b'),
            'journal du projet : aucune balise <i> ni <b> ne doit naître des entrées').toHaveCount(0);

        /* Et les entrées se lisent intactes, chevrons compris — initiales
           comprises : « <D » doit rester deux caractères dans sa pastille,
           pas devenir le début d'une balise qui avale la suite. */
        await expect(pastilles(page), 'initiales intactes, une pastille par entrée').toHaveText(INITIALES_BALISEES);
        for (const { actorName, action, entityName } of JOURNAL_BALISE(jeton)) {
            for (const texte of [actorName, action, `"${entityName}"`]) {
                await expect(corps(page), `journal balisé, « ${texte} » intact`).toContainText(texte);
            }
        }

        await fermer(page);
    } finally {
        /* Retirer tout panneau resté ouvert après un échec — sans écrire
           en base. Les bouchons, eux, sont déjà retirés : ils ne vivent que
           le temps de l'appel. Une erreur ici ne doit pas remplacer le
           motif de l'échec : la page appartient au seul test, elle est
           jetée ensuite. */
        await page.evaluate(() => document.getElementById('_historyPanel')?.remove()).catch(() => {});
    }
});
