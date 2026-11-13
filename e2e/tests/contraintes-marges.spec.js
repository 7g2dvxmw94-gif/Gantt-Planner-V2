import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle des CONTRAINTES
 * DE DATE, et le point 12 du rapport DCMA (test du chemin critique).
 *
 * LE BESOIN. Depuis la PR 2 (#115), le moteur place une tâche selon sa
 * contrainte : une « Fin au plus tard le 30/06 » (FNLT) ne finit jamais
 * après le 30/06, une « Doit commencer le 15/06 » (MSO) commence le 15/06.
 * Mais analyzeNetwork() (store.js), qui donne la marge et le chemin
 * critique, ne lit pas les contraintes : sa passe arrière n'est bornée que
 * par la fin du projet. Une tâche qui DOIT finir le 30/06 y garde la marge
 * qu'elle aurait si elle pouvait glisser jusqu'au 31/12, et une MSO tenue,
 * qui ne peut pas bouger d'un jour, n'est pas critique.
 *
 * LA RÈGLE ATTENDUE (plan.md §2 (b), comme MS Project et P6). La passe
 * arrière est bornée aussi par les contraintes, en rang de jour ouvré de la
 * date EFFECTIVE (celle du placement) : SNLT et MSO bornent le début au plus
 * tard, FNLT et MFO la fin au plus tard ; SNET et FNET ne bornent rien. La
 * marge est le minimum de deux marges calculées dans la même passe :
 * `margeFin` (bornée par la seule fin du projet, la marge d'aujourd'hui) et
 * `margeContrainte` (bornée par les seules contraintes, Infinity sans
 * contrainte en aval).
 *
 * ET LE POINT 12 GARDE SA CIBLE. Il retarde une tâche critique reliée, rejoue
 * le planning, et regarde la fin du projet reculer. Une MFO tenue HORS du
 * chemin deviendrait critique par sa contrainte, et la plus précoce : le
 * test la retarderait, la contrainte la remettrait en place, la fin ne
 * bougerait pas, et le point 12 dirait « alerte » d'un planning sain. Les
 * candidates du point 12 sont donc les tâches critiques PAR LES LIENS
 * (margeFin ≤ 0).
 *
 * LE VRAI MOTEUR, PAS UNE COPIE. Montage de chemin-critique-marge-negative
 * et de dcma-calcul : un objet qui hérite du prototype du store et ne lui
 * substitue que getTasks(), getTask() et _getCalendar(). Le planning
 * n'existe que dans la page ; rien n'est écrit en base. Le test n'appelle ni
 * applyPredecessorConstraints, ni propagateDependencies, ni
 * _recalculatePhase : ils écrivent dans Supabase.
 *
 * JUIN 2026 COMMENCE UN LUNDI et n'a aucun férié (22 jours ouvrés).
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, « marge de B » : 143 reçu au lieu de 14. Les discriminants
 * passent. */

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });
const C = (constraintType, constraintDate) => ({ constraintType, constraintDate });

/** Le réseau du plan (PR 4). A, semaine du 1er juin ; B, Fin→Début de A,
 *  « Fin au plus tard le 30/06 », placée 08→10 ; Z, longue, porte la fin
 *  du projet au 31/12 ; M, racine « Doit commencer le 15/06 », placée
 *  15→17. S'y ajoutent deux racines « au plus tôt », tenues à leur date :
 *  N « Début au plus tôt le 08/06 » et Q « Fin au plus tôt le 10/06 »,
 *  placées 08→10. */
const RESEAU = [
    T('A', '2026-06-01', '2026-06-05'),
    T('B', '2026-06-08', '2026-06-10', [L('A')], C('FNLT', '2026-06-30')),
    T('Z', '2026-06-01', '2026-12-31'),
    T('M', '2026-06-15', '2026-06-17', [], C('MSO', '2026-06-15')),
    T('N', '2026-06-08', '2026-06-10', [], C('SNET', '2026-06-08')),
    T('Q', '2026-06-08', '2026-06-10', [], C('FNET', '2026-06-10')),
];
/** Le même, sans aucune contrainte. */
const RESEAU_NU = RESEAU.map(({ constraintType, constraintDate, ...t }) => t);

/** Un lien de chaque type, décalages positif et négatif : A 01→03, B liée
 *  à A et placée par le moteur, W témoin 01→19 qui porte la fin. Le lien
 *  est tenu au plus juste : la marge de A est celle de B, et un écart mal
 *  calculé pour ce type les sépare. */
const PAR_LIEN = [
    ['FS+3', L('A', 'FS', 3),  '2026-06-08', '2026-06-10'],
    ['FS-2', L('A', 'FS', -2), '2026-06-02', '2026-06-04'],
    ['SS+2', L('A', 'SS', 2),  '2026-06-03', '2026-06-05'],
    ['FF+1', L('A', 'FF', 1),  '2026-06-02', '2026-06-04'],
    ['SF+3', L('A', 'SF', 3),  '2026-06-03', '2026-06-04'],
].map(([nom, lien, debut, fin]) => [nom, [
    T('A', '2026-06-01', '2026-06-03'), T('B', debut, fin, [lien]), T('W', '2026-06-01', '2026-06-19'),
]]);

/** Point 12. « R hors du chemin » : R, racine « Doit finir le 05/06 »
 *  tenue en 03→05, et son successeur S ne portent pas la fin ; A → C, si.
 *  « MFO sur le chemin » : A, « Doit finir le 10/06 », porte la fin par C. */
const HORS_CHEMIN = [
    T('R', '2026-06-03', '2026-06-05', [], C('MFO', '2026-06-05')),
    T('S', '2026-06-08', '2026-06-09', [L('R')]),
    T('A', '2026-06-08', '2026-06-10'),
    T('C', '2026-06-11', '2026-06-30', [L('A')]),
];
const MFO_SUR_CHEMIN = [
    T('A', '2026-06-08', '2026-06-10', [], C('MFO', '2026-06-10')),
    T('C', '2026-06-11', '2026-06-30', [L('A')]),
];

async function mesurer(page, reseaux) {
    return page.evaluate(async ({ reseaux }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const dcma = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteurDe = (taches) => Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        /* Infinity ne passe pas la frontière de page.evaluate sous tous les
           sérialiseurs : il est rendu en chaîne. */
        const lisible = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === Infinity ? 'Infinity' : v]));
        const sortie = { joursOuvresJuin: utils.workingDaysBetween('2026-06-01', '2026-06-30', cal) };
        for (const [nom, taches] of Object.entries(reseaux)) {
            const moteur = moteurDe(taches);
            const a = moteur.analyzeNetwork();
            const p12 = dcma.evaluerDcma({
                taches, calendrier: cal, dateEtat: '2026-06-01', analyse: a,
                placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
            }).points.find(p => p.n === 12);
            sortie[nom] = {
                /* Le placement que le moteur donnerait à chaque tâche : null
                   (rien à placer) ou ses dates. */
                places: Object.fromEntries(taches.map(t => {
                    const p = moteur.computeConstrainedDatesIn(t, moteur.getTask);
                    return [t.id, p ? `${p.startDate}→${p.endDate}` : null];
                })),
                marges: a.float,
                critiques: [...moteur.getCriticalPath()].sort(),
                margeFin: lisible(a.margeFin),
                margeContrainte: lisible(a.margeContrainte),
                point12: `${p12.etat} recul ${p12.valeur} cible ${p12.cibleId}`,
            };
        }
        return sortie;
    }, { reseaux });
}

test('les marges respectent les contraintes de date, et le point 12 garde sa cible', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const r = await mesurer(page, {
        reseau: RESEAU, nu: RESEAU_NU, horsChemin: HORS_CHEMIN, mfoSurChemin: MFO_SUR_CHEMIN,
        ...Object.fromEntries(PAR_LIEN),
    });

    /* DISCRIMINANT 0 — LE CALENDRIER ET LE PLACEMENT SONT CEUX QU'ON CROIT.
       Juin 2026 compte 22 jours ouvrés, et le moteur laisse B en 08→10 et M
       en 15→17 : les tâches sont déjà là où leurs liens et leurs
       contraintes les mettent. Ferme : « les marges mesurent un planning
       que le moteur aurait déplacé, ou un autre calendrier ». Passe avant
       comme après. */
    expect(r.joursOuvresJuin, 'jours ouvrés de juin 2026').toBe(22);
    expect(r.reseau.places, 'placement du réseau par le moteur').toEqual({
        A: null, B: '2026-06-08→2026-06-10', Z: null, M: '2026-06-15→2026-06-17',
        N: '2026-06-08→2026-06-10', Q: '2026-06-08→2026-06-10',
    });

    /* DISCRIMINANT 1 — SANS CONTRAINTE, RIEN NE CHANGE. Le réseau sans ses
       contraintes garde les marges et le chemin critique d'aujourd'hui, et,
       pour un lien de chaque type (décalages positif et négatif), la marge
       de A reste celle de B. Valeurs mesurées sur main (1231c5b). Ferme :
       « la factorisation de l'écart par exigenceDuLien, ou le second
       tableau de la passe arrière, a changé le calcul ». Passe avant comme
       après. */
    expect(r.nu.marges, 'marges du réseau sans contrainte').toEqual({ A: 143, B: 143, Z: 0, M: 138, N: 143, Q: 143 });
    expect(r.nu.critiques, 'chemin critique du réseau sans contrainte').toEqual(['Z']);
    const parLien = Object.fromEntries(PAR_LIEN.map(([nom]) => [nom, { places: r[nom].places.B, marges: r[nom].marges }]));
    expect(parLien, 'un lien de chaque type, sans contrainte').toEqual({
        'FS+3': { places: '2026-06-08→2026-06-10', marges: { A: 7,  B: 7,  W: 0 } },
        'FS-2': { places: '2026-06-02→2026-06-04', marges: { A: 11, B: 11, W: 0 } },
        'SS+2': { places: '2026-06-03→2026-06-05', marges: { A: 10, B: 10, W: 0 } },
        'FF+1': { places: '2026-06-02→2026-06-04', marges: { A: 11, B: 11, W: 0 } },
        'SF+3': { places: '2026-06-03→2026-06-04', marges: { A: 11, B: 11, W: 0 } },
    });

    /* DISCRIMINANT 2 — LA FIN DU PROJET EST CELLE QU'ON CROIT. Z, qui la
       porte au 31/12, a une marge nulle et est critique. Ferme : « la passe
       arrière ne part pas du 31/12 », qui donnerait aussi d'autres marges
       à A et B. Passe avant comme après. */
    expect(r.reseau.marges.Z, 'marge de Z').toBe(0);
    expect(r.reseau.critiques, 'Z est critique').toContain('Z');

    /* DISCRIMINANT 3 — POINT 12, « R HORS DU CHEMIN » : ok, recul 600,
       cible A. Ferme : « les bornes rendent critique une MFO tenue hors du
       chemin, et le point 12 la retarde à la place de A » — la contrainte
       la remettrait en place, la fin ne reculerait pas, et le rapport
       dirait « alerte » d'un planning sain. Passe avant (R n'est pas
       critique) comme après (R l'est par sa contrainte, pas par ses
       liens). */
    expect(r.horsChemin.point12, 'point 12, R hors du chemin').toBe('ok recul 600 cible A');

    /* DISCRIMINANT 4 — POINT 12, « MFO SUR LE CHEMIN » : alerte, recul 0,
       cible A. A porte la fin par ses liens ; sa contrainte absorbe le
       retard injecté. Ferme : « le correctif écarte du test toute tâche
       contrainte, et ne voit plus une contrainte dure sur le chemin ».
       Passe avant comme après (c'est l'effet voulu de la PR 2). */
    expect(r.mfoSurChemin.point12, 'point 12, MFO sur le chemin').toBe('alerte recul 0 cible A');

    // --- L'ASSERTION CENTRALE : la passe arrière lit les contraintes.
    /* B doit finir le 30/06 : 14 jours ouvrés après le 10/06 (11 → 30/06).
       A, qui la précède, n'en a pas plus. */
    expect(r.reseau.marges.B, 'marge de B').toBe(14);
    expect(r.reseau.marges.A, 'marge de A').toBe(14);
    /* M doit commencer le 15/06, et y est : marge nulle, critique. */
    expect(r.reseau.marges.M, 'marge de M').toBe(0);
    expect(r.reseau.critiques, 'chemin critique du réseau contraint').toEqual(['M', 'Z']);
    /* N et Q, « au plus tôt », ne retiennent pas une tâche qui glisse plus
       tard : leur marge reste celle de la fin du projet, comme dans MS
       Project. */
    expect({ N: r.reseau.marges.N, Q: r.reseau.marges.Q }, 'marges des « au plus tôt »').toEqual({ N: 143, Q: 143 });
    /* Les deux marges dont la marge est le minimum, calculées dans la même
       passe : celle de la fin du projet (la marge d'avant) et celle des
       contraintes. Z, N et Q n'ont aucune contrainte qui borne, en aval
       ou sur elles-mêmes. */
    expect(r.reseau.margeFin, 'margeFin').toEqual({ A: 143, B: 143, Z: 0, M: 138, N: 143, Q: 143 });
    expect(r.reseau.margeContrainte, 'margeContrainte').toEqual({ A: 14, B: 14, Z: 'Infinity', M: 0, N: 'Infinity', Q: 'Infinity' });
});
