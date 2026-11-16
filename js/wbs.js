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

/** '2.1.10' → [2, 1, 10] ; null pour un texte qui n'est pas un code. */
export function segmentsWbs(code) {
    if (typeof code !== 'string' || !/^[1-9]\d*(\.[1-9]\d*)*$/.test(code)) return null;
    return code.split('.').map(Number);
}

/** Tri naturel des codes : 1.2 < 1.10 < 2 ; un parent avant ses enfants ;
 *  une valeur qui n'est pas un code (tâche hors de l'arbre) en dernier. */
export function comparerCodesWbs(a, b) {
    const sa = segmentsWbs(a), sb = segmentsWbs(b);
    if (!sa || !sb) return (sa ? 0 : 1) - (sb ? 0 : 1);
    for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
        if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return sa.length - sb.length;
}

/** Texte d'une cellule → code WBS normalisé, ou null.
 *  ' 1.2 ' → '1.2' ; '01.2' → '1.2' ; '1.0' → '1' (Excel écrit souvent
 *  « 1.0 » pour un lot de premier niveau) ; refusés : '', '0', '1..2',
 *  'A.1', '1,2', '1.0.1', '1.2.0'. */
export function lireCodeWbs(valeur) {
    let s = String(valeur ?? '').trim();
    if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
    if (!/^\d+(\.\d+)*$/.test(s)) return null;
    const segments = s.split('.').map(x => Number(x));
    if (segments.some(n => !Number.isInteger(n) || n < 1)) return null;
    return segments.join('.');
}

/** Reconstruit une hiérarchie depuis des codes lus d'un tableur.
 *  @param {Array<string|null>} codes  un code normalisé par ligne, ou null
 *  @returns {{ parentDe: Array<number|null>, ordre: number[],
 *    aDesEnfants: Set<number>, anomalies: { doublons: string[],
 *    parentsAbsents: number, sansCode: number } }}
 *  Parent de a.b.c = a.b ; s'il manque, le plus proche ancêtre présent,
 *  sinon la racine. Ordre : tri naturel des codes, les lignes sans code à
 *  la fin dans leur ordre. Des doublons rendent la hiérarchie
 *  inutilisable : l'appelant importe alors à plat. */
export function reconstruireWbsDepuisCodes(codes) {
    const index = new Map();
    const doublons = new Set();
    codes.forEach((c, i) => {
        if (!c) return;
        if (index.has(c)) doublons.add(c); else index.set(c, i);
    });
    const parentDe = codes.map(() => null);
    const aDesEnfants = new Set();
    let parentsAbsents = 0;
    codes.forEach((c, i) => {
        if (!c) return;
        const segs = c.split('.');
        let trouve = null;
        for (let k = segs.length - 1; k >= 1 && trouve === null; k--) {
            const p = segs.slice(0, k).join('.');
            if (index.has(p)) trouve = index.get(p);
            else if (k === segs.length - 1) parentsAbsents++;
        }
        parentDe[i] = trouve;
        if (trouve !== null) aDesEnfants.add(trouve);
    });
    const avecCode = codes.map((c, i) => i).filter(i => codes[i]);
    avecCode.sort((a, b) => comparerCodesWbs(codes[a], codes[b]) || a - b);
    const sansCode = codes.map((c, i) => i).filter(i => !codes[i]);
    return {
        parentDe, aDesEnfants,
        ordre: [...avecCode, ...sansCode],
        anomalies: { doublons: [...doublons], parentsAbsents, sansCode: sansCode.length },
    };
}
