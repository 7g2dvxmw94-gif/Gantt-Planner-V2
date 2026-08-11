/* Faux client Supabase, pour les tests du filet de nettoyage.
 *
 *  Ne sert QUE cleanup-net.spec.js : cleanup.js importe ses modules par
 *  URL relative à la page (`new URL('js/store.js', document.baseURI)`), on
 *  lui présente donc un arbre de même forme, servi par le serveur statique
 *  des tests. Aucun compte, aucun réseau — le filet est ainsi vérifiable
 *  hors de Supabase, y compris ses branches d'échec.
 *
 *  L'état vit dans localStorage plutôt qu'en mémoire : il doit survivre à
 *  un rechargement ET être partagé entre les onglets d'un même contexte,
 *  le filet ouvrant une page de secours quand celle du test a disparu.
 *  sessionStorage, propre à l'onglet, laisserait ce scénario passer sans
 *  rien vérifier. */

function rows() {
    return JSON.parse(localStorage.getItem('projects') || '[]');
}

function setRows(next) {
    localStorage.setItem('projects', JSON.stringify(next));
}

export const supabase = {
    from() {
        return {
            select() {
                return {
                    in(_colonne, ids) {
                        return Promise.resolve({
                            data: rows().filter(r => ids.includes(r.id)).map(r => ({ id: r.id })),
                            error: null,
                        });
                    },
                };
            },
        };
    },

    rpc(_nom, { p_project_id }) {
        /* Mode « indestructible » : la RPC dit oui et ne supprime rien.
           C'est exactement le comportement de supabaseStore.deleteProject(),
           qui journalise l'erreur sans la propager — le cas que le filet
           doit détecter par relecture plutôt que de croire sur parole. */
        if (!localStorage.getItem('undeletable')) {
            setRows(rows().filter(r => r.id !== p_project_id));
        }
        return Promise.resolve({ error: null });
    },
};

export const __table = { rows, setRows };
