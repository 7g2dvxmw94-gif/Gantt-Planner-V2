import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § I1 (étape 1 : l'accès aux paramètres) et § AC1
 * (navigation au clavier) : où se trouve le focus quand on referme le
 * panneau de réglages aussitôt ouvert. Le bouton des réglages est
 * #settingsBtn — l'avatar à initiales de l'en-tête, que TEST_PLAN appelle
 * « icône engrenage ».
 *
 * LE DÉFAUT : open() diffère le focus de 100 ms,
 *
 *     if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
 *
 * et close() n'annule jamais ce minuteur. Refermé avant ces 100 ms, le
 * panneau voit le minuteur jouer APRÈS sa fermeture et tirer le focus sur
 * #settingsPanelClose : un bouton d'un panneau fermé, hors écran
 * (translateX(100%)), dont l'anneau de focus ne se voit pas. close() avait
 * pourtant rendu le focus à #settingsBtn ; le minuteur le lui reprend.
 * L'utilisateur au clavier ne voit plus où il est, et sa tabulation
 * suivante part dans les contrôles du panneau fermé.
 *
 * QUI REFERME EN MOINS DE 100 ms. Rarement une main : Entrée puis Échap très
 * rapprochés sur #settingsBtn, ou un double-clic quasi instantané. Un
 * double-clic au rythme humain ne suffit pas — mesuré : dès 50 ms d'écart,
 * le second clic tombe sur le panneau en train d'entrer, qui ne referme
 * rien. Mais un test, oui : c'est ce qui a rendu instable un test de #80
 * (run 36451438060, échec au premier essai, succès à la reprise). Et les
 * boutons des onglets Synchro, Aide et Abonnement, qui referment le
 * panneau puis ouvrent une autre fenêtre, se voyaient voler le focus par
 * le minuteur s'ils jouaient dans ces 100 ms.
 *
 * CE TEST NE JUGE PAS LE REPORT LUI-MÊME, seulement qu'il survive à la
 * fermeture. La raison qu'open() en donne — le voile en transition sur
 * `visibility` rendrait .focus() sans effet — ne vaut pas pour ce bouton,
 * qui n'est pas dans le voile : un focus immédiat y prend, mesuré dans
 * Chromium avec la vraie feuille de style. C'est un autre sujet, traité à
 * part.
 *
 * POURQUOI DANS LA PAGE, ET NON PAR DES GESTES PLAYWRIGHT. Le défaut est une
 * course contre 100 ms. Piloté depuis Playwright, chaque geste est un
 * aller-retour avec le navigateur, dont la durée varie d'un runner à
 * l'autre — exactement ce qui a rendu instable le test de #80. Les deux
 * activations sont donc données dans le même tour de la page, par
 * bouton.click() : elles passent par le gestionnaire réel (_bindToggle(),
 * puis toggle()), et aucun minuteur ne peut s'intercaler entre elles.
 *
 * LES ATTENTES NE SONT PAS DES COURSES. Une attente de ATTENTE_MS, posée
 * APRÈS le minuteur d'open(), a une échéance plus tardive que lui : elle ne
 * peut pas se terminer avant qu'il ait joué, quelle que soit la charge du
 * runner. Le premier discriminant vérifie que le minuteur joue bien dans
 * cette attente ; l'ordre, lui, tient aux échéances.
 *
 * Le rouge attendu pour ce commit de test est UN échec, sur l'assertion
 * centrale, avec le message « focus repris par #settingsPanelClose ».
 */

/* Quatre fois le report d'open(). La marge ne sert pas l'ordre — il tient
   aux échéances, voir plus haut —, elle évite seulement de dépendre d'un
   arrondi des minuteurs. */
const ATTENTE_MS = 400;

test('refermer aussitôt les réglages laisse le focus sur leur bouton', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const mesure = await page.evaluate(async (attente) => {
        const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
        const panneau = document.querySelector('.settings-panel');
        const bouton = document.getElementById('settingsBtn');
        const etat = () => {
            const el = document.activeElement;
            return {
                id: el ? el.id : null,
                dansLePanneau: !!el && !!el.closest('.settings-panel'),
                ouvert: panneau.classList.contains('open'),
                modal: panneau.getAttribute('aria-modal'),
            };
        };

        // Témoin : une ouverture simple, laissée à elle-même.
        bouton.click();
        await attendre(attente);
        const temoin = etat();
        bouton.click();              // refermer, par le même chemin
        await attendre(attente);
        const avant = etat();

        /* Pendant le geste, toute entrée du focus dans le panneau ALORS
           QU'IL EST FERMÉ. Une entrée pendant qu'il est ouvert serait
           légitime et n'est pas comptée. */
        const entreesPanneauFerme = [];
        const guetter = (e) => {
            if (e.target.closest && e.target.closest('.settings-panel')
                && !panneau.classList.contains('open')) {
                entreesPanneauFerme.push(e.target.id || e.target.className);
            }
        };
        document.addEventListener('focusin', guetter);

        // Le geste : ouvrir puis refermer, dans le même tour de la page.
        bouton.click();
        bouton.click();
        const aussitot = etat();
        await attendre(attente);
        const apres = etat();
        document.removeEventListener('focusin', guetter);

        return { temoin, avant, aussitot, apres, entreesPanneauFerme };
    }, ATTENTE_MS);

    /* DISCRIMINANT 1 — LE MINUTEUR JOUE DANS L'ATTENTE CHOISIE.
       Ouvert et laissé seul, le panneau reçoit le focus avant la fin de
       ATTENTE_MS. Ferme deux mensonges : une attente trop courte pour que
       le minuteur joue — l'assertion centrale passerait alors sans rien
       mesurer —, et un correctif qui supprimerait le focus d'ouverture
       au lieu d'annuler le minuteur : le panneau s'ouvrirait sans prendre
       le focus, et l'assertion centrale passerait quand même. Passe avant
       comme après. */
    expect(mesure.temoin, 'ouverture simple : le focus doit entrer dans le panneau').toEqual({
        id: 'settingsPanelClose', dansLePanneau: true, ouvert: true, modal: 'true',
    });

    /* DISCRIMINANT 2 — LE TÉMOIN NE LAISSE RIEN DERRIÈRE LUI.
       Refermé après que son minuteur a joué, le panneau rend le focus à
       #settingsBtn et le garde. Sans ce point, un reste du témoin pourrait
       expliquer l'état final à la place du geste mesuré. */
    expect(mesure.avant, 'après le témoin : panneau fermé, focus sur #settingsBtn').toEqual({
        id: 'settingsBtn', dansLePanneau: false, ouvert: false, modal: null,
    });

    /* DISCRIMINANT 3 — LE GESTE A BIEN REFERMÉ, ET close() A BIEN RENDU LE
       FOCUS. Si la seconde activation n'avait pas refermé le panneau, un
       focus à l'intérieur serait légitime ; si close() ne rendait pas le
       focus, l'assertion centrale ne dirait pas que le minuteur l'a
       DÉPLACÉ. C'est l'état de départ dont elle mesure l'écart. Passe avant
       comme après. */
    expect(mesure.aussitot, 'aussitôt après le geste : panneau fermé, focus sur #settingsBtn').toEqual({
        id: 'settingsBtn', dansLePanneau: false, ouvert: false, modal: null,
    });

    /* DISCRIMINANT 4 — RIEN N'A ROUVERT LE PANNEAU PENDANT L'ATTENTE.
       Rouvert, il aurait légitimement le focus, et l'échec de l'assertion
       centrale ne dirait rien du minuteur. Passe avant comme après. */
    expect(mesure.apres.ouvert, 'le panneau ne doit pas s\'être rouvert').toBe(false);

    /* --- L'ASSERTION CENTRALE ---
       Le focus est resté là où close() l'avait mis. Le message nomme
       l'élément qui l'a pris : tant que le défaut tient, ce sera
       #settingsPanelClose, ce qui confirme le mécanisme — le minuteur
       d'open() — et pas seulement le symptôme. */
    expect(mesure.apres.id, `focus repris par #${mesure.apres.id}`).toBe('settingsBtn');

    /* Et il n'est jamais entré dans le panneau fermé, même un instant. Sans
       cette ligne, un faux correctif qui rendrait le focus à #settingsBtn
       APRÈS le minuteur — un second report dans close() — passerait au
       vert alors que le focus transite toujours par le bouton caché. Avant
       le correctif, l'assertion précédente échoue la première et celle-ci
       n'est pas atteinte. */
    expect(mesure.entreesPanneauFerme, 'le focus est entré dans le panneau fermé').toEqual([]);
});
