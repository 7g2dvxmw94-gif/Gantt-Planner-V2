import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre la fonction t() de js/i18n.js, qu'aucune section de
 * docs/TEST_PLAN.md ne vise en propre. Le symptôme mesuré est dans le
 * rapport DCMA (§ E2, chemin critique) : la liste « Anomalies des liens ».
 *
 * LE DÉFAUT : t(key, replacements) substitue les {placeholders} UN PAR UN,
 * chacun sur le texte que le précédent vient de produire :
 *
 *     Object.entries(replacements).forEach(([k, v]) => {
 *         str = str.split('{' + k + '}').join(String(v));
 *     });
 *
 * Une VALEUR qui contient elle-même « {phase} » est donc réécrite par la
 * substitution suivante. app.js appelle, pour un lien vers une phase :
 *
 *     t('dcma.anomalie.phase', { tache: nom(l.tacheId), phase: nom(l.versId) })
 *
 * Une tâche nommée « Réception {phase} », liée à la phase « Gros œuvre »,
 * s'affiche alors « « Réception Gros œuvre » dépend de la phase « Gros
 * œuvre » ». Le nom saisi par l'utilisateur est déformé, et c'est l'ordre
 * des clés de l'objet qui décide du résultat : dans l'ordre inverse, le
 * nom ressort intact.
 *
 * CHANGER L'ORDRE NE CORRIGE PAS. Mesuré sur le texte réel de t(), hors
 * navigateur : une tâche « {phase} » liée à une phase « {tache} » ressort
 * déformée dans les deux ordres de clés — « {tache} » deux fois dans
 * l'ordre d'app.js, « {phase} » deux fois dans l'ordre inverse.
 *
 * LE DÉFAUT N'EST PAS PROPRE AU DCMA. Mesuré sur le texte réel de t(),
 * hors navigateur : un projet « Archive {service} » sauvegardé sur
 * OneDrive s'annonce « "Archive OneDrive" sauvegardé sur OneDrive »
 * (toast.cloudSaveProject), un projet « Rapport {date} » s'imprime en
 * pied de PDF « Rapport » suivi de la date d'export (pdf.footer). Le
 * rapport DCMA est retenu ici parce que ses deux valeurs sont des noms
 * libres.
 *
 * LE TEST N'ÉCRIT AUCUNE CHARGE ACTIVE : « {phase} » est du texte inerte.
 * Montrer que le nom n'arrive pas intact suffit à établir le défaut.
 *
 * t() EST UNE FONCTION GLOBALE d'un script classique (js/i18n.js, chargé
 * par index.html avant les modules), donc window.t. Dans l'application,
 * elle est là dès que la page est prête, et on l'utilise telle quelle :
 * recharger le script la redéclarerait, et ses `const` lèveraient une
 * erreur. Si window.t est absente — page réduite à une coquille, comme
 * dans un harnais local sans Supabase —, on charge le VRAI js/i18n.js
 * servi à côté de la page, jamais une copie.
 *
 * LA LANGUE EST ÉPINGLÉE : t() relit localStorage.gantt_lang à chaque
 * appel. Chaque mesure la fixe à 'fr' puis rend la valeur trouvée, pour ne
 * rien laisser derrière elle.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « noms contenant des accolades, ordre d'app.js » —, ses deux
 * appels déformés. */

const PHASE = 'dcma.anomalie.phase';

/* Chaque appel est passé comme [clé, [[nom, valeur], …]] : l'objet des
   valeurs est reconstruit DANS la page par Object.fromEntries, qui garde
   l'ordre donné. L'ordre des clés est ici la variable mesurée ; il ne
   doit dépendre d'aucune sérialisation. */
async function traduire(page, appels) {
    return page.evaluate((appels) => {
        const avant = localStorage.getItem('gantt_lang');
        localStorage.setItem('gantt_lang', 'fr');
        try {
            return appels.map(([cle, valeurs]) => window.t(cle, Object.fromEntries(valeurs)));
        } finally {
            if (avant === null) localStorage.removeItem('gantt_lang');
            else localStorage.setItem('gantt_lang', avant);
        }
    }, appels);
}

test('i18n : une valeur contenant « {nom} » n\'est pas substituée à son tour', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
    /* Le repli lit le fichier par fetch(), qui décode toujours en UTF-8,
       puis l'exécute en script classique. Un <script src> hériterait de
       l'encodage de la page : une coquille sans <meta charset>, servie
       sans charset, le lit en windows-1252, et « » devient « Â» ». Mesuré
       au premier essai — le discriminant 1 l'a arrêté. */
    if (!(await page.evaluate(() => typeof window.t === 'function'))) {
        const source = await page.evaluate(async () => {
            const r = await fetch(new URL('js/i18n.js', document.baseURI));
            if (!r.ok) throw new Error(`js/i18n.js : HTTP ${r.status}`);
            return r.text();
        });
        await page.addScriptTag({ content: source });
    }

    /* DISCRIMINANT 1 — DES NOMS SANS ACCOLADES SE SUBSTITUENT NORMALEMENT,
       DANS LE GABARIT FRANÇAIS. Ferme deux mensonges : un t() qui ne
       serait pas celui de js/i18n.js, ou une langue mal épinglée — l'échec
       central porterait alors sur le gabarit anglais, pas sur le défaut.
       Le 0 vérifie que la conversion reste String(v) : un correctif qui
       testerait la valeur (`v || …`) laisserait « {n} » et passerait
       pourtant l'assertion centrale. Passe avant comme après. */
    expect(await traduire(page, [
        [PHASE, [['tache', 'Réception'], ['phase', 'Gros œuvre']]],
        ['dcma.selectionner', [['n', 0]]],
    ]), 'noms sans accolades').toEqual([
        '« Réception » dépend de la phase « Gros œuvre », ignorée par le chemin critique',
        'Sélectionner (0)',
    ]);

    /* DISCRIMINANT 2 — UN {nom} SANS VALEUR RESTE TEL QUEL, comme
       aujourd'hui. Ferme le vert d'un correctif qui effacerait les
       placeholders inconnus, ou y écrirait « undefined » : il passerait
       l'assertion centrale en changeant tous les autres textes. Passe avant
       comme après. */
    expect(await traduire(page, [[PHASE, [['tache', 'Réception']]]]), 'placeholder sans valeur').toEqual([
        '« Réception » dépend de la phase « {phase} », ignorée par le chemin critique',
    ]);

    /* DISCRIMINANT 3 — DANS L'ORDRE INVERSE DES CLÉS, LE NOM RESSORT DÉJÀ
       INTACT. Ferme l'explication concurrente du rouge : que « {phase} »
       soit altéré dans une valeur par autre chose que la substitution en
       chaîne — le transport vers la page, ou un t() qui refuserait les
       accolades. Si ce point passe, une valeur contenant « {phase} »
       arrive intacte et ressort intacte quand aucune substitution ne la
       suit : l'échec central ne peut venir que d'une substitution
       appliquée à une valeur déjà insérée — c'est le défaut. Passe avant
       comme après. */
    expect(await traduire(page, [[PHASE, [['phase', 'Gros œuvre'], ['tache', 'Réception {phase}']]]]),
        'nom contenant « {phase} », ordre inverse').toEqual([
        '« Réception {phase} » dépend de la phase « Gros œuvre », ignorée par le chemin critique',
    ]);

    /* --- L'ASSERTION CENTRALE : l'ordre d'app.js, { tache, phase }.
       Le second appel croise les noms : tâche « {phase} », phase
       « {tache} ». La substitution en chaîne les déforme dans les deux
       ordres de clés. Il arrête un correctif qui garderait la chaîne en ne
       changeant que l'ordre — clés triées, ou placeholders du gabarit lus
       de droite à gauche — : le premier appel le laisserait passer, un nom
       serait encore déformé. */
    expect(await traduire(page, [
        [PHASE, [['tache', 'Réception {phase}'], ['phase', 'Gros œuvre']]],
        [PHASE, [['tache', '{phase}'], ['phase', '{tache}']]],
    ]), 'noms contenant des accolades, ordre d\'app.js').toEqual([
        '« Réception {phase} » dépend de la phase « Gros œuvre », ignorée par le chemin critique',
        '« {phase} » dépend de la phase « {tache} », ignorée par le chemin critique',
    ]);
});
