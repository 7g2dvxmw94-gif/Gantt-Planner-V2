/* ========================================
   DÉCONNEXION APRÈS INACTIVITÉ (audit de sécurité, point S1)

   La session Supabase est gardée dans le navigateur et renouvelée
   automatiquement : sans ce module, elle durait indéfiniment, et un poste
   laissé ouvert donnait accès à tous les projets.

   LA RÈGLE (choix de l'utilisateur : 30 minutes) :
   - au bout de 29 minutes sans activité, une fenêtre d'avertissement
     décompte la dernière minute, avec « Rester connecté » ;
   - à 30 minutes, déconnexion de CE navigateur et retour à l'écran de
     connexion, qui dit pourquoi.

   LA DERNIÈRE ACTIVITÉ EST PARTAGÉE ENTRE ONGLETS (localStorage, clé
   CLE_ACTIVITE) : travailler dans un onglet garde les autres ouverts, et
   l'avertissement se ferme partout. Elle est relue à chaque vérification —
   toutes les 5 secondes, et au retour de l'onglet ou de la mise en veille
   (focus, visibilitychange) — : une minuterie seule ne verrait pas une
   veille de deux heures.

   DÉCONNEXION LOCALE (scope 'local') : elle ferme la session de ce
   navigateur, pas celles des autres appareils de l'utilisateur.
   ======================================== */

import { supabase } from './supabase-client.js';

export const DELAI_INACTIVITE_MS = 30 * 60 * 1000;
export const DUREE_AVERTISSEMENT_MS = 60 * 1000;
export const CLE_ACTIVITE = 'gp.derniereActivite';
/** Lu par auth.html pour dire pourquoi on y revient. */
export const CLE_RAISON = 'gp.deconnexionInactivite';

const EVENEMENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'];
const PAS_VERIFICATION_MS = 5000;
const ECART_ECRITURE_MS = 5000;

function lireActivite() {
    try {
        const v = Number(localStorage.getItem(CLE_ACTIVITE));
        return Number.isFinite(v) && v > 0 ? v : null;
    } catch { return null; }
}

function ecrireActivite(t) {
    try { localStorage.setItem(CLE_ACTIVITE, String(t)); } catch { /* stockage indisponible */ }
}

export function demarrerSurveillanceInactivite() {
    let derniere = Date.now();
    let fenetre = null;
    let decompte = null;
    let fini = false;

    ecrireActivite(derniere);

    const activite = () => {
        if (fini || fenetre) return;   // l'avertissement se ferme par son bouton
        const t = Date.now();
        if (t - derniere < ECART_ECRITURE_MS) return;
        derniere = t;
        ecrireActivite(t);
    };

    const fermerAvertissement = () => {
        if (!fenetre) return;
        fenetre.remove();
        fenetre = null;
        decompte = null;
    };

    const ouvrirAvertissement = () => {
        if (fenetre) return;
        fenetre = document.createElement('div');
        fenetre.className = 'inactivite-voile';
        fenetre.innerHTML = `
            <div class="inactivite-boite" role="alertdialog" aria-modal="true"
                 aria-labelledby="inactiviteTitre" aria-describedby="inactiviteTexte">
                <h2 id="inactiviteTitre"></h2>
                <p id="inactiviteTexte"></p>
                <button type="button" class="btn btn-primary" id="inactiviteRester"></button>
            </div>`;
        fenetre.querySelector('#inactiviteTitre').textContent = t('inactivity.title');
        fenetre.querySelector('#inactiviteRester').textContent = t('inactivity.stay');
        decompte = fenetre.querySelector('#inactiviteTexte');
        fenetre.querySelector('#inactiviteRester').addEventListener('click', () => {
            derniere = Date.now();
            ecrireActivite(derniere);
            fermerAvertissement();
        });
        // Échap ne ferme pas : seul le bouton dit « je suis là ».
        fenetre.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') { e.preventDefault(); fenetre.querySelector('#inactiviteRester').focus(); }
        });
        document.body.appendChild(fenetre);
        fenetre.querySelector('#inactiviteRester').focus();
    };

    const deconnecter = async () => {
        if (fini) return;
        fini = true;
        fermerAvertissement();
        try { sessionStorage.setItem(CLE_RAISON, '1'); } catch { /* sans message */ }
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } finally {
            window.location.href = 'auth.html';
        }
    };

    const verifier = () => {
        if (fini) return;
        // La valeur partagée fait foi : chaque onglet n'y écrit que
        // Date.now(), c'est donc toujours la plus récente des activités.
        const partagee = lireActivite();
        if (partagee) derniere = partagee;
        const reste = DELAI_INACTIVITE_MS - (Date.now() - derniere);
        if (reste <= 0) { deconnecter(); return; }
        if (reste <= DUREE_AVERTISSEMENT_MS) {
            ouvrirAvertissement();
            decompte.textContent = t('inactivity.text', { s: Math.ceil(reste / 1000) });
        } else {
            fermerAvertissement();
        }
    };

    EVENEMENTS.forEach(ev => document.addEventListener(ev, activite, { passive: true, capture: true }));
    window.addEventListener('focus', verifier);
    document.addEventListener('visibilitychange', verifier);
    window.addEventListener('storage', (e) => { if (e.key === CLE_ACTIVITE) verifier(); });
    setInterval(verifier, PAS_VERIFICATION_MS);
}
