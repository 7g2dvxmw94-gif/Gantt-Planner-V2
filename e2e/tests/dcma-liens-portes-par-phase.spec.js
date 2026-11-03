import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle des anomalies
 * de liens du rapport DCMA 14 points.
 *
 * LE DÉFAUT : un lien PORTÉ PAR UNE PHASE disparaît du rapport. Un lien
 * est porté par son successeur (task.dependencies), et js/dcma.js ne
 * recense que ceux des tâches qui ne sont pas des phases :
 *
 *     nonPhases.forEach(succ => {
 *         (succ.dependencies || []).forEach(dep => { … });
 *     });
 *
 * Une phase qui dépend d'une autre phase, ou d'une tâche, n'est donc
 * jamais lue : ni comptée — ce qui est juste, analyzeNetwork() écarte les
 * phases —, ni SIGNALÉE — ce qui ne l'est pas. Le lien inverse, d'une
 * tâche VERS une phase, est signalé : « ignorée par le chemin critique ».
 * Le même lien, porté de l'autre côté, est passé sous silence.
 *
 * CES LIENS EXISTENT. L'import MS Project XML pose isPhase sur les
 * récapitulatives et leur attache leurs <PredecessorLink> ; la fenêtre de
 * tâche masque ensuite les prédécesseurs d'une phase, et rien ne les
 * montre plus.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * LE PLANNING, celui du constat, complété d'un lien vers une tâche
 * supprimée : la phase P1 (A → B), la phase P2 qui dépend de P1 (C → D),
 * la phase P3 qui dépend de la tâche D (E), la tâche F qui dépend de la
 * phase P2, et la phase P4 qui dépend de X, une tâche supprimée — un lien
 * qui survit dans dependencies, deleteTask ne le nettoyant pas.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « liens portés par une phase, signalés ». */

const T = (id, debut, fin, preds = [], extra = {}) => ({
    id, name: id, startDate: debut, endDate: fin, progress: 0,
    dependencies: preds.map(p => ({ taskId: p, type: 'FS', lag: 0 })), ...extra,
});
const PHASE = { isPhase: true };
const PLANNING = [
    T('P1', '2026-06-01', '2026-06-12', [], PHASE),
    T('A', '2026-06-01', '2026-06-05', [], { parentId: 'P1' }),
    T('B', '2026-06-08', '2026-06-12', ['A'], { parentId: 'P1' }),
    T('P2', '2026-06-15', '2026-06-26', ['P1'], PHASE),
    T('C', '2026-06-15', '2026-06-19', [], { parentId: 'P2' }),
    T('D', '2026-06-22', '2026-06-26', ['C'], { parentId: 'P2' }),
    T('P3', '2026-06-29', '2026-07-03', ['D'], PHASE),
    T('E', '2026-06-29', '2026-07-03', [], { parentId: 'P3' }),
    T('F', '2026-06-29', '2026-07-03', ['P2']),
    T('P4', '2026-07-06', '2026-07-10', ['X'], PHASE),
];

async function evaluer(page, taches) {
    return page.evaluate(async ({ taches }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteurDe = (ts) => Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => ts, getTask: (id) => ts.find(t => t.id === id), _getCalendar: () => cal,
        });
        const moteur = moteurDe(taches);
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat: '2026-06-01',
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        // Le même planning, phases dépouillées de leurs liens.
        const sansLiensDePhase = taches.map(t => (t.isPhase ? { ...t, dependencies: [] } : t));
        return {
            liens: r.liens, population: r.population, anomalies: r.anomalies,
            marges: moteur.analyzeNetwork().float,
            margesSansLiensDePhase: moteurDe(sansLiensDePhase).analyzeNetwork().float,
        };
    }, { taches });
}

test('DCMA : un lien porté par une phase est signalé, comme un lien vers une phase', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const r = await evaluer(page, PLANNING);

    /* DISCRIMINANT 1 — LE RÉSEAU COMPTE LES LIENS VOULUS, ET EUX SEULS :
       B ← A et D ← C, entre six tâches incomplètes. Ferme deux mensonges :
       « le planning n'est pas celui que les comptes supposent », et un
       correctif qui, pour signaler les liens de phase, les compterait aussi
       comme liens du réseau — P3 ← D porterait le compte à 3, alors que le
       chemin critique l'ignore. Passe avant comme après. */
    expect({ liens: r.liens, population: r.population }, 'périmètre du rapport')
        .toEqual({ liens: 2, population: 6 });

    /* DISCRIMINANT 2 — LE LIEN VERS UNE PHASE EST SIGNALÉ, ET LUI SEUL.
       Ferme « isPhase n'est pas lu comme le test le suppose » : sans lui,
       l'absence de signalement des liens de phase ne dirait rien de la
       boucle des liens. Ferme aussi un correctif qui parcourrait toutes les
       tâches au lieu des seules non-phases : P2 ← P1 tomberait alors ici,
       et l'on lirait « P2 dépend de la phase P1 » sans rien dire de P3 ← D.
       Passe avant comme après. */
    expect({ liensVersPhase: r.anomalies.liensVersPhase, liensSansType: r.anomalies.liensSansType },
        'liens vers une phase, liens sans type')
        .toEqual({ liensVersPhase: [{ tacheId: 'F', versId: 'P2' }], liensSansType: [] });

    /* DISCRIMINANT 3 — LE CHEMIN CRITIQUE IGNORE BIEN LES LIENS PORTÉS PAR
       UNE PHASE : les marges sont les mêmes avec ou sans eux, et ce sont
       celles qu'on attend jusqu'au 3 juillet (A, B : 15 jours ouvrés ; C,
       D : 5 ; E, F : 0). Ferme « l'anomalie dit ignoré par le chemin
       critique, et le chemin critique les lit » : signaler serait alors
       mentir. Passe avant comme après. */
    expect(r.marges, 'marges avec les liens de phase').toEqual(r.margesSansLiensDePhase);
    expect(r.marges, 'marges du planning').toEqual({ A: 15, B: 15, C: 5, D: 5, E: 0, F: 0 });

    // --- L'ASSERTION CENTRALE ---
    expect({ liensDePhase: r.anomalies.liensDePhase, liensFantomes: r.anomalies.liensFantomes },
        'liens portés par une phase, signalés').toEqual({
        liensDePhase: [{ phaseId: 'P2', versId: 'P1' }, { phaseId: 'P3', versId: 'D' }],
        liensFantomes: [{ tacheId: 'P4', versId: 'X' }],
    });
});
