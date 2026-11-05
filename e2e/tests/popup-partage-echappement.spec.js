import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* La popup de partage de projet — notifications project_shared et
 * project_removed — et ce qu'elle fait des noms qu'elle affiche.
 *
 * LE DÉFAUT : _showProjectSharedPopup() (app.js) assemble sa boîte par
 * innerHTML et y interpole deux noms sans les échapper :
 *
 *     <span …>${projectName}</span>                       (projectRow)
 *     bodyTxt = `${actorName} vous a donné accès au projet`
 *     <p …>${bodyTxt}</p>
 *
 * Ces deux noms viennent D'UN AUTRE COMPTE. Les RPC notify_project_shared
 * et notify_project_removed (migrations 009 et 011), qu'appelle
 * supabase-store.js, recopient dans la notification le nom du projet
 * partagé (projects.name, dans task_name avant le « | ») et celui de
 * l'acteur (profiles.full_name, ou à défaut son e-mail) : ni l'un ni
 * l'autre n'est choisi par le compte qui lit la popup. Faute
 * d'échappement, ce qu'un compte écrit devient du balisage dans la page
 * d'un autre.
 *
 * Comme pour l'export PDF (#48), les vues Coûts (#49), l'infobulle (#50)
 * et le Dashboard (#51), le test n'écrit AUCUNE charge active : des
 * balises inertes, <i> et <b>, suffisent à montrer que le nom n'arrive
 * pas intact.
 *
 * RIEN N'EST ÉCRIT DANS LE COMPTE PARTAGÉ. Aucune notification réelle,
 * aucun projet partagé : le test appelle la vraie méthode, sur window.app,
 * avec des notifications fabriquées ici. Elles n'ont pas d'id : la
 * méthode n'en note donc aucun dans localStorage à l'ouverture et n'en
 * marque aucun comme lu à la fermeture. La fermeture recharge pourtant les
 * projets depuis Supabase (store.initFromSupabase()) : ce rechargement,
 * et par précaution le marquage « lue », sont remplacés par des bouchons,
 * rétablis dans un finally.
 *
 * QUATRE DISPOSITIONS, parce que la méthode a quatre phrases qui
 * interpolent l'acteur (un projet partagé, plusieurs, un retrait, un
 * mélange) et deux gabarits de ligne qui interpolent le projet (partagé,
 * retiré). Corriger une branche sans les autres laisserait le défaut en
 * place — c'est ce qui s'était produit entre #48 et #49.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale de la première disposition — deux balises <i> et <b> nées des
 * noms là où il n'en faut aucune. */

const partage = (projet, acteur) => ({ type: 'project_shared', taskName: `${projet}|editor`, actorName: acteur });
const retrait = (projet, acteur) => ({ type: 'project_removed', taskName: `${projet}|viewer`, actorName: acteur });

const ACTEUR = 'Alice <b>D.</b>';
const projetNord = (jeton) => `Chantier <i>Nord</i> ${jeton}`;
const projetSud  = (jeton) => `Dépôt <i>Sud</i> ${jeton}`;

/* Chaque disposition rend les noms balisés dans une phrase différente. */
const DISPOSITIONS = [
    { cas: 'partage, un projet', notifs: (j) => [partage(projetNord(j), ACTEUR)],
      projets: (j) => [projetNord(j)], phrase: `${ACTEUR} vous a donné accès au projet` },
    { cas: 'partage, deux projets', notifs: (j) => [partage(projetNord(j), ACTEUR), partage(projetSud(j), ACTEUR)],
      projets: (j) => [projetNord(j), projetSud(j)], phrase: `${ACTEUR} vous a donné accès à ces projets` },
    { cas: 'retrait', notifs: (j) => [retrait(projetNord(j), ACTEUR)],
      projets: (j) => [projetNord(j)], phrase: `${ACTEUR} vous a retiré de ces projets` },
    { cas: 'partage et retrait', notifs: (j) => [partage(projetNord(j), ACTEUR), retrait(projetSud(j), ACTEUR)],
      projets: (j) => [projetNord(j), projetSud(j)], phrase: `Modifications par ${ACTEUR}` },
];

/* La boîte de la popup est le parent de son bouton OK. Elle est repérée
   par un JETON propre à chaque ouverture, porté par le nom du projet :
   le compte est partagé, et une vraie popup du compte pourrait s'ouvrir
   en même temps que celle-ci. Le jeton survit à la troncature — il est
   hors des balises —, il désigne donc la même boîte avant et après le
   correctif. */
const boite = (page, jeton) => page.locator('div:has(> #_sharedOkBtn)', { hasText: jeton });

async function ouvrir(page, notifs) {
    await page.evaluate((n) => window.app._showProjectSharedPopup(n), notifs);
}

/* dispatchEvent plutôt que click() : une vraie popup du compte, ouverte
   par-dessus, intercepterait le pointeur — et la fermer, elle, marquerait
   de vraies notifications comme lues. */
async function fermer(popup) {
    await popup.locator('#_sharedOkBtn').dispatchEvent('click');
    await expect(popup).toHaveCount(0);
}

const appelsBouchons = (page) => page.evaluate(() => window.__bouchonsPopup.appels.slice());

test('la popup de partage n\'interprète pas comme du balisage les noms venus d\'un autre compte', async ({ page }) => {
    const suffixe = Date.now();

    await page.goto('index.html');
    await waitForAppReady(page);

    /* Les bouchons sont posés sur les MÊMES instances que celles d'app.js :
       un import par URL relative à la page désigne le module déjà chargé
       (voir cleanup.js), pas une copie. */
    await page.evaluate(async () => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { supabaseStore } = await import(new URL('js/supabase-store.js', base).href);
        const appels = [];
        const remplacer = (objet, cle, bouchon) => {
            const propre = Object.prototype.hasOwnProperty.call(objet, cle);
            const original = objet[cle];
            objet[cle] = bouchon;
            return () => { if (propre) objet[cle] = original; else delete objet[cle]; };
        };
        window.__bouchonsPopup = {
            appels,
            retablir: [
                remplacer(store, 'initFromSupabase', async () => { appels.push('initFromSupabase'); }),
                remplacer(supabaseStore, 'markNotificationRead', async () => { appels.push('markNotificationRead'); }),
            ],
        };
    });

    try {
        /* DISCRIMINANT 1 — AVEC DES NOMS ORDINAIRES, LA POPUP S'AFFICHE ET
           MONTRE LES DEUX NOMS. Ferme « la méthode n'a rien rendu » : sans
           ce point, l'absence de balises plus bas pourrait venir d'une
           popup vide ou jamais ouverte. Passe avant comme après. */
        const jetonOrdinaire = `${suffixe}-ordinaire`;
        const projetOrdinaire = `Chantier Nord ${jetonOrdinaire}`;
        await ouvrir(page, [partage(projetOrdinaire, 'Alice D.')]);
        const popupOrdinaire = boite(page, jetonOrdinaire);
        await expect(popupOrdinaire, 'popup avec des noms ordinaires').toBeVisible();
        await expect(popupOrdinaire).toContainText(projetOrdinaire);
        await expect(popupOrdinaire).toContainText('Alice D. vous a donné accès au projet');

        /* DISCRIMINANT 1 bis — LE GABARIT LUI-MÊME NE CONTIENT NI <i> NI
           <b>. Ferme « les balises comptées plus bas viennent de la
           popup, pas des noms » : sans ce point, l'assertion centrale
           pourrait échouer sur un correctif juste. Passe avant comme
           après. */
        await expect(popupOrdinaire.locator('i, b'), 'balises du gabarit, sans nom balisé').toHaveCount(0);

        /* DISCRIMINANT 1 ter — OK FERME LA POPUP, ET SA FERMETURE PASSE PAR
           LE BOUCHON. Ferme deux mensonges : une popup restée ouverte
           intercepterait la suite et le nettoyage ; et un bouchon posé sur
           une copie du module laisserait la fermeture recharger depuis
           Supabase. Exactement un rechargement, aucun marquage « lue ».
           Passe avant comme après. */
        await fermer(popupOrdinaire);
        expect(await appelsBouchons(page), 'appels interceptés à la fermeture').toEqual(['initFromSupabase']);

        for (const [i, { cas, notifs, projets, phrase }] of DISPOSITIONS.entries()) {
            const jeton = `${suffixe}-${i}`;
            await ouvrir(page, notifs(jeton));
            const popup = boite(page, jeton);
            await expect(popup, `popup « ${cas} »`).toBeVisible();

            /* DISCRIMINANT 2 — LE TEXTE DE CETTE BOÎTE PORTE LES NOMS, au
               moins dans ce qui survit au défaut : les mots hors balises et
               ceux qu'elles entourent. Ferme « le test ne lit pas le bon
               élément » : une autre boîte, ou une boîte sans les noms, ne
               les contiendrait pas. Passe avant comme après. */
            for (const fragment of ['Chantier', 'Nord', 'Alice', 'D.', jeton]) {
                await expect(popup, `popup « ${cas} », fragment « ${fragment} »`).toContainText(fragment);
            }

            /* --- L'ASSERTION CENTRALE ---
               Aucune balise ne doit naître des noms : ni <i> du nom du
               projet, ni <b> de celui de l'acteur. Faute d'échappement,
               le navigateur les crée. */
            await expect(popup.locator('i, b'),
                `popup « ${cas} » : aucune balise <i> ni <b> ne doit naître des noms`).toHaveCount(0);

            /* Et les noms se lisent intacts, chevrons compris. */
            for (const projet of projets(jeton)) {
                await expect(popup, `popup « ${cas} », nom du projet intact`).toContainText(projet);
            }
            await expect(popup, `popup « ${cas} », nom de l'acteur intact`).toContainText(phrase);

            await fermer(popup);
        }
    } finally {
        /* Fermer, bouchons encore en place, toute popup de CE test restée
           ouverte après un échec ; puis rétablir. Une erreur ici ne doit
           pas remplacer le motif de l'échec : la page appartient au seul
           test, elle est jetée ensuite. */
        await page.evaluate((s) => {
            const b = window.__bouchonsPopup;
            document.querySelectorAll('#_sharedOkBtn').forEach(btn => {
                if (btn.parentElement.textContent.includes(s)) btn.click();
            });
            b?.retablir.forEach(f => f());
            delete window.__bouchonsPopup;
        }, String(suffixe)).catch(() => {});
    }
});
