import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § AC1 (navigation au clavier), en prolongement de
 * #63 — qui a corrigé UN contrôle là où six sont concernés.
 *
 * LE DÉFAUT : `transition: all` INCLUT `visibility`.
 *
 *     .btn, .icon-btn, .select, .color-swatch, .milestone-status-btn {
 *         transition: all var(--transition-fast);
 *     }
 *
 * Un contrôle placé dans une fenêtre modale hérite de la `visibility` de
 * l'overlay. À l'ouverture celle-ci passe de `hidden` à `visible`, et le
 * contrôle démarre alors sa PROPRE transition sur cette valeur héritée :
 * à l'instant zéro il vaut encore `hidden`, donc n'est pas focalisable, et
 * un `.focus()` appelé dans la même tâche synchrone ne fait rien — sans
 * erreur ni trace dans la console.
 *
 * C'est le mécanisme exact que #63 a établi. Il y a été traité sur
 * `.input` seulement, parce que c'est le seul contrôle qu'une modale
 * focalise aujourd'hui. Les cinq autres portent le même défaut, latent.
 *
 * CE TEST MESURE UNE PROPRIÉTÉ DES FEUILLES DE STYLE, PAS UN PARCOURS
 * UTILISATEUR — et il faut le dire, car c'est inhabituel ici. Aucun
 * parcours ne l'atteint : l'application n'a qu'une seule fenêtre dont la
 * classe `.active` est BASCULÉE sur un overlay déjà présent (la fenêtre de
 * tâche), et elle focalise un `.input`. Les autres modales créent leur
 * overlay avec `.active` déjà posée puis l'insèrent — aucune transition ne
 * se déclenche sur le style initial d'un élément inséré, elles sont donc
 * immunisées. Mesuré, les deux motifs :
 *
 *     motif basculé : .input OK, les cinq autres visibility=hidden, focus KO
 *     motif inséré  : les six OK
 *
 * Le test reconstitue donc le motif vulnérable directement, sur la page
 * réelle et avec les feuilles de style réelles. Il ne prouve pas qu'un
 * utilisateur rencontre le défaut aujourd'hui ; il prouve que le contrat
 * « un contrôle révélé dans une modale est focalisable » ne tient pas, et
 * il le prouvera encore le jour où une modale focalisera un bouton.
 *
 * `.input` FIGURE DANS LA LISTE À DESSEIN : le test verrouille du même
 * coup le correctif de #63, qu'aucun test ne protégeait directement.
 */

const CLASSES = ['input', 'btn', 'icon-btn', 'select', 'color-swatch', 'milestone-status-btn'];

test('un contrôle révélé dans une fenêtre modale est focalisable aussitôt', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const mesure = await page.evaluate((classes) => {
        /* <select> et <input> ne sont pas des <button> : la balise doit
           correspondre à la classe, sinon le contrôle ne serait pas
           focalisable pour une raison étrangère au défaut. */
        const baliseDe = (c) => (c === 'select' ? 'select' : c === 'input' ? 'input' : 'button');

        const construire = (classe) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            const cible = document.createElement(baliseDe(classe));
            cible.className = classe;
            modal.appendChild(cible);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            return { overlay, cible };
        };

        /* DISCRIMINANT — LES FEUILLES DE STYLE SONT BIEN APPLIQUÉES.
           Sans lui, un CSS non chargé rendrait TOUT focalisable et le test
           passerait sans rien mesurer : le pire des verts. Un overlay
           fermé doit calculer `visibility: hidden`. */
        const temoin = construire('btn');
        const visibiliteFermee = getComputedStyle(temoin.overlay).visibility;
        temoin.overlay.remove();

        const echecs = [];
        for (const classe of classes) {
            const { overlay, cible } = construire(classe);
            /* L'état FERMÉ doit être calculé avant la bascule : c'est lui
               qui donne à la transition sa valeur de départ. Sans ce
               reflow, le navigateur ne verrait qu'un seul état et aucune
               transition ne démarrerait — on mesurerait le motif inséré,
               qui n'est pas celui qui échoue. */
            void overlay.offsetHeight;

            overlay.classList.add('active');   // = _show()
            cible.focus();                     // = la ligne qui suit dans openCreate()

            if (document.activeElement !== cible) {
                echecs.push(`.${classe} (visibility=${getComputedStyle(cible).visibility})`);
            }
            overlay.remove();
        }
        return { visibiliteFermee, echecs };
    }, CLASSES);

    /* Le discriminant d'abord : il doit échouer AVANT l'assertion centrale
       si le CSS manque, faute de quoi celle-ci mentirait. */
    expect(mesure.visibiliteFermee).toBe('hidden');

    /* --- L'ASSERTION CENTRALE ---
       La liste, plutôt qu'un booléen : l'échec nomme alors les contrôles
       fautifs et leur visibilité calculée, ce qui rend le rouge lisible
       sans ouvrir la trace. */
    expect(mesure.echecs).toEqual([]);
});
