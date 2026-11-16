/* ============================================================
   Numérotation WBS (structure de découpage du projet).

   Module PUR : il n'importe rien, ne lit ni le store, ni le DOM, ni
   Supabase. Il numérote l'arbre DÉJÀ ORDONNÉ que lui passe l'appelant
   (store.getTaskTree()) et ne refait pas l'ordre : un second tri, ici,
   serait une deuxième implémentation de la même règle, appelée à
   diverger de la première.

   Règles :
   1. Les racines de l'arbre sont le niveau 1, numérotées 1, 2, 3… dans
      l'ordre où l'arbre les donne.
   2. Un enfant prend le code de son parent, un point, puis son rang
      parmi ses frères, à partir de 1 : 2.1, 2.2, 2.2.1…
   3. Toutes les lignes sont numérotées : phases, tâches, jalons,
      permis, enfants d'une tâche ordinaire.
   4. Une tâche absente de l'arbre (parent disparu, boucle de parents)
      n'a pas de code.
   5. Un id déjà numéroté est ignoré s'il revient : un arbre mal formé
      ne fait pas boucler la numérotation.

   build.py concatène les modules dans une seule portée : tous les noms
   de premier niveau contiennent « Wbs » pour ne heurter personne.
   ============================================================ */

/**
 * @param {Array<{id: string, children?: Array}>} arbre  racines ordonnées
 * @returns {{ codes: Map<string, string>, noeuds: Array<{ id: string,
 *   code: string, niveau: number, parentId: string|null, rang: number,
 *   nbFreres: number, enfants: string[] }> }}
 *   `noeuds` suit l'ordre de l'arbre (parcours en profondeur, parent
 *   avant ses enfants) : c'est l'ordre des codes.
 */
export function numeroterWbs(arbre) {
    const codes = new Map();
    const noeuds = [];
    /* Numérote une fratrie et rend les ids retenus. */
    const parcourirWbs = (freres, prefixe, niveau, parentId) => {
        const vusIci = new Set();
        const retenus = (freres || []).filter(n => {
            if (!n || n.id == null || codes.has(n.id) || vusIci.has(n.id)) return false;
            vusIci.add(n.id);
            return true;
        });
        retenus.forEach((n, i) => codes.set(n.id, prefixe ? `${prefixe}.${i + 1}` : String(i + 1)));
        retenus.forEach((n, i) => {
            const code = codes.get(n.id);
            const noeud = { id: n.id, code, niveau, parentId, rang: i + 1, nbFreres: retenus.length, enfants: [] };
            noeuds.push(noeud);
            noeud.enfants = parcourirWbs(n.children, code, niveau + 1, n.id);
        });
        return retenus.map(n => n.id);
    };
    parcourirWbs(arbre, '', 1, null);
    return { codes, noeuds };
}
