import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique) sous l'angle de son
 * prolongement : le contrôle de robustesse du planning DCMA 14 points.
 *
 * CE QUI EST MESURÉ : le CALCUL des 14 points, js/dcma.js, sur des
 * plannings construits pour l'occasion — chacun porte des écarts connus,
 * comptés à la main avant d'être mesurés. Le module est pur : il ne lit
 * rien lui-même, et ce test lui passe tout. Rien n'est écrit en base.
 *
 * LE VRAI MOTEUR, PAS UNE COPIE. La marge totale et le placement des
 * tâches viennent des méthodes du store — analyzeNetwork(),
 * computeConstrainedDatesIn() —, appelées sur le planning du test par un
 * objet qui hérite du prototype du store et ne lui substitue que ses
 * entrées : getTasks(), getTask(), _getCalendar(). C'est le code même que
 * l'application exécute.
 *
 * LA DATE D'ÉTAT EST FIXÉE (15 juin 2026), pas lue sur l'horloge : les
 * points 9, 11, 13 et 14 en dépendent, et le résultat ne doit pas changer
 * d'un jour à l'autre. JUIN 2026 COMMENCE UN LUNDI.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : les quatre tests échouent sur
 * leur assertion centrale — le tableau des 14 points —, qui reçoit alors
 * « module DCMA absent — … ». Les discriminants, eux, ne touchent que ce
 * qui existe déjà (getCriticalPath, le placement, le calendrier) et
 * passent avant comme après. */

const DATE_ETAT = '2026-06-15';

const T = (id, debut, fin, liens = [], extra = {}) =>
    ({ id, name: id, startDate: debut, endDate: fin, dependencies: liens, progress: 0, ...extra });
const L = (taskId, type = 'FS', lag = 0) => ({ taskId, type, lag });

/** Évalue le module dans la page. Les témoins sont mesurés AVANT l'import
 *  du module : ils existent avant comme après la fonctionnalité. */
async function evaluer(page, taches, extra = {}) {
    return page.evaluate(async ({ taches, extra, dateEtat }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches,
            getTask: (id) => taches.find(t => t.id === id),
            _getCalendar: () => cal,
        });
        const temoins = {
            critique: moteur.getCriticalPath(),
            placements: Object.fromEntries(taches.filter(t => (t.dependencies || []).length)
                .map(t => [t.id, moteur._computeConstrainedDates(t)])),
            joursOuvresJuinJuillet: utils.workingDaysBetween('2026-06-01', '2026-07-31', cal),
        };
        let dcma;
        try {
            dcma = await import(new URL('js/dcma.js', base).href);
        } catch (e) {
            return { temoins, absent: String((e && e.message) || e) };
        }
        const rapport = dcma.evaluerDcma({
            taches, calendrier: cal, dateEtat, ...extra,
            analyse: moteur.analyzeNetwork(),
            placer: (t, getTask) => moteur.computeConstrainedDatesIn(t, getTask),
        });
        return { temoins, rapport };
    }, { taches, extra, dateEtat: DATE_ETAT });
}

/** Le tableau des 14 points en une ligne : n°, valeur, état. */
const tableau = (r) => r.rapport
    ? r.rapport.points.map(p => `${p.n}:${p.valeur === null ? '—' : p.valeur}:${p.etat}`).join(' ')
    : `module DCMA absent — ${r.absent}`;
const fautives = (r, n) => r.rapport.points.find(p => p.n === n).fautives;

test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);
});

test('DCMA, liens : logique, avances, décalages, types et anomalies', async ({ page }) => {
    /* Neuf tâches incomplètes. Six liens valides :
         B←A FS · C←A FS −2 (avance) · D←B FS · D←C SS +3 · E←D FS +1 · N←A sans type
       et trois liens qui n'en sont pas : G vers une tâche supprimée (X), J
       vers la phase PH, N sans type — compté FS comme le fait le chemin
       critique, mais signalé.
       Logique : A sans prédécesseur, E et N sans successeur, G, K et J
       isolés → 6/9. Avances 1/6. Décalages 2/6. FS 5/6. */
    const taches = [
        T('A', '2026-06-01', '2026-06-05'),
        T('B', '2026-06-08', '2026-06-12', [L('A')]),
        T('C', '2026-06-04', '2026-06-10', [L('A', 'FS', -2)]),
        T('D', '2026-06-15', '2026-06-19', [L('B'), L('C', 'SS', 3)]),
        T('E', '2026-06-23', '2026-06-24', [L('D', 'FS', 1)]),
        T('G', '2026-06-01', '2026-06-02', [L('X')]),
        T('PH', '2026-06-01', '2026-06-03', [], { isPhase: true }),
        T('K', '2026-06-01', '2026-06-03', [], { parentId: 'PH' }),
        T('J', '2026-06-04', '2026-06-05', [L('PH')]),
        T('N', '2026-06-08', '2026-06-09', [{ taskId: 'A' }]),
    ];
    const r = await evaluer(page, taches);

    /* DISCRIMINANT — LE RÉSEAU EST CELUI QU'ON CROIT. Le chemin critique
       existant le lit tel quel : seule E porte la fin. Ferme « le planning
       du test n'est pas celui que les comptes supposent ». Passe avant
       comme après. */
    expect(r.temoins.critique, 'chemin critique du planning').toEqual(['E']);

    // --- L'ASSERTION CENTRALE : les 14 points ---
    expect(tableau(r), 'les 14 points').toBe(
        '1:66.7:alerte 2:16.7:alerte 3:33.3:alerte 4:83.3:alerte 5:—:sans-objet 6:0:ok 7:—:na '
        + '8:0:ok 9:7:alerte 10:100:info 11:—:na 12:—:na 13:—:na 14:—:na');

    expect(fautives(r, 1)).toEqual(['A', 'E', 'G', 'K', 'J', 'N']);
    expect(fautives(r, 2)).toEqual(['C']);
    expect(fautives(r, 3)).toEqual(['D', 'E']);
    expect(fautives(r, 4)).toEqual(['D']);
    expect(r.rapport.anomalies).toEqual({
        liensFantomes: [{ tacheId: 'G', versId: 'X' }],
        liensVersPhase: [{ tacheId: 'J', versId: 'PH' }],
        liensSansType: [{ tacheId: 'N', versId: 'A' }],
        margesNegatives: [],
    });
    expect({ population: r.rapport.population, liens: r.rapport.liens }).toEqual({ population: 9, liens: 6 });
});

test('DCMA, marges et durées : seuil de 44 jours ouvrés, permis à part, échéance', async ({ page }) => {
    /* L44 dure exactement 44 jours ouvrés (le 14 juillet est férié), L45 un
       de plus : seule L45 dépasse le seuil du point 8. Le permis PC, de
       trois mois, le dépasserait aussi — il est exclu des points 8 et 10.
       Z (terminée) et M (jalon) sortent de la population. B est chargée par
       une affectation, L44 par un coût fixe. */
    const taches = [
        T('A', '2026-06-01', '2026-06-05'),
        T('B', '2026-06-08', '2026-06-12', [L('A')], { assignees: ['r1'] }),
        T('L44', '2026-06-01', '2026-07-31', [], { fixedCosts: [{ name: 'x', amount: 100 }] }),
        T('L45', '2026-06-01', '2026-08-03'),
        T('PC', '2026-06-01', '2026-09-01', [], { isPermit: true }),
        T('Z', '2026-06-01', '2026-06-02', [], { progress: 100 }),
        T('M', '2026-06-15', '2026-06-15', [L('B')], { isMilestone: true }),
    ];
    const r = await evaluer(page, taches);

    /* DISCRIMINANT 1 — LE SEUIL TOMBE OÙ ON LE CROIT. Du 1er juin au
       31 juillet 2026, le calendrier compte 44 jours ouvrés. Si le 14
       juillet n'était pas férié, L44 en ferait 45 et le point 8 compterait
       deux tâches : l'échec dirait alors quelque chose du calendrier, pas
       du module. Passe avant comme après. */
    expect(r.temoins.joursOuvresJuinJuillet, 'jours ouvrés du 1er juin au 31 juillet 2026').toBe(44);

    /* DISCRIMINANT 2 — LE PERMIS PORTE LA FIN DU PROJET : c'est contre elle
       que se mesurent les marges, en l'absence d'échéance. */
    expect(r.temoins.critique, 'chemin critique du planning').toEqual(['PC']);

    // --- L'ASSERTION CENTRALE, sans échéance ---
    expect(tableau(r), 'les 14 points, sans échéance').toBe(
        '1:80:alerte 2:0:ok 3:0:ok 4:100:ok 5:—:sans-objet 6:40:alerte 7:—:na '
        + '8:25:alerte 9:5:alerte 10:50:info 11:—:na 12:—:na 13:—:na 14:—:na');
    expect(fautives(r, 6)).toEqual(['A', 'B']);
    expect(fautives(r, 8)).toEqual(['L45']);
    expect(fautives(r, 10)).toEqual(['A', 'L45']);
    expect(r.rapport.permisExclus).toEqual(['PC']);

    /* Avec une échéance au 14 août, douze jours ouvrés AVANT la fin prévue
       (1er septembre) : toutes les marges se translatent d'autant. Le
       permis passe en marge négative (point 7), plus aucune ne dépasse 44
       (point 6), et le CPLI devient mesurable : (56 − 12) / 56 = 0,79. */
    const r2 = await evaluer(page, taches, { echeance: '2026-08-14' });
    expect(tableau(r2), 'les 14 points, échéance au 14 août').toBe(
        '1:80:alerte 2:0:ok 3:0:ok 4:100:ok 5:—:sans-objet 6:0:ok 7:20:alerte '
        + '8:25:alerte 9:5:alerte 10:50:info 11:—:na 12:—:na 13:0.79:alerte 14:—:na');
    expect(fautives(r2, 7)).toEqual(['PC']);
});

test('DCMA, référence et date d\'état : dates invalides, tâches manquées, CPLI, BEI', async ({ page }) => {
    /* Date d'état : lundi 15 juin. Dans la référence, A, B, C et E devaient
       être finies (fin ≤ 15 juin).
         A finie à l'heure · B finie le 12 au lieu du 10 · C à 50 % · E pas
           commencée → manquées : B, C, E sur 4 (point 11).
         Dates invalides (point 9) : C et E finissent avant la date d'état
           sans être finies, F est commencée mais débute le 17.
         G n'est pas dans la référence : elle entre au dénominateur du BEI
           (PAM 3.1.2.4) → 2 terminées / 5 = 0,4 (point 14).
         CPLI : 10 jours ouvrés jusqu'à la fin prévue (26 juin), marge de
           −5 sur la fin de référence (19 juin) → 5/10 = 0,5 ; avec une
           échéance au 3 juillet, +5 → 1,5. */
    const taches = [
        T('A', '2026-06-01', '2026-06-05', [], { progress: 100 }),
        T('B', '2026-06-08', '2026-06-12', [L('A')], { progress: 100 }),
        T('C', '2026-06-08', '2026-06-12', [L('A')], { progress: 50 }),
        T('D', '2026-06-16', '2026-06-19', [L('C')]),
        T('E', '2026-06-10', '2026-06-12'),
        T('F', '2026-06-17', '2026-06-19', [], { progress: 30 }),
        T('G', '2026-06-22', '2026-06-26', [L('D')]),
    ];
    const baseline = { tasks: [
        { id: 'A', startDate: '2026-06-01', endDate: '2026-06-05' },
        { id: 'B', startDate: '2026-06-08', endDate: '2026-06-10' },
        { id: 'C', startDate: '2026-06-08', endDate: '2026-06-12' },
        { id: 'D', startDate: '2026-06-16', endDate: '2026-06-19' },
        { id: 'E', startDate: '2026-06-10', endDate: '2026-06-12' },
        { id: 'F', startDate: '2026-06-17', endDate: '2026-06-19' },
    ] };
    const r = await evaluer(page, taches, { baseline });

    /* DISCRIMINANT — LE RÉSEAU EST CELUI QU'ON CROIT : D et G portent la
       fin. Le point 12 retardera D, la tâche critique reliée la plus
       précoce. Passe avant comme après. */
    expect(r.temoins.critique, 'chemin critique du planning').toEqual(['D', 'G']);

    // --- L'ASSERTION CENTRALE ---
    expect(tableau(r), 'les 14 points, avec référence').toBe(
        '1:60:alerte 2:0:ok 3:0:ok 4:100:ok 5:—:sans-objet 6:0:ok 7:—:na '
        + '8:0:ok 9:3:alerte 10:100:info 11:75:alerte 12:600:ok 13:0.5:alerte 14:0.4:alerte');
    expect(fautives(r, 9)).toEqual(['C', 'E', 'F']);
    expect(fautives(r, 11)).toEqual(['B', 'C', 'E']);
    expect(r.rapport.points[12]).toMatchObject({ cpl: 10, tf: -5, cible: '2026-06-19', approche: ['cible-baseline', 'date-etat-aujourdhui'] });

    const r2 = await evaluer(page, taches, { baseline, echeance: '2026-07-03' });
    expect(r2.rapport.points[12]).toMatchObject({ valeur: 1.5, etat: 'ok', cpl: 10, tf: 5 });
});

test('DCMA, test du chemin critique : le retard se propage, sauf si un lien est rompu', async ({ page }) => {
    /* Réseau sain : A → B → C, C avec un décalage de 3 jours calendaires.
       Retarder A de 600 jours ouvrés doit faire reculer d'autant la fin —
       mesurée SANS A : c'est la propagation par les liens qui compte. Le
       décalage calendaire, réaligné sur un jour ouvré, peut la faire varier
       de quelques jours ; la tolérance est de 10. */
    const sain = await evaluer(page, [
        T('A', '2026-06-01', '2026-06-05'),
        T('B', '2026-06-08', '2026-06-12', [L('A')]),
        T('C', '2026-06-16', '2026-06-22', [L('B', 'FS', 3)]),
        T('D', '2026-06-01', '2026-06-03'),
    ]);
    /* Réseau rompu : B dépend de A par un lien SANS TYPE. Le chemin critique
       le lit comme un Fin→Début et rend A critique ; le placement, lui,
       l'ignore. C'est la logique cassée que ce test du PAM existe pour
       débusquer : retarder A ne déplace rien. */
    const rompu = await evaluer(page, [
        T('A', '2026-06-01', '2026-06-05'),
        T('B', '2026-06-08', '2026-06-12', [{ taskId: 'A' }]),
        T('D', '2026-06-01', '2026-06-03'),
    ]);

    /* DISCRIMINANT 1 — LES DEUX RÉSEAUX SONT CEUX QU'ON CROIT. */
    expect(sain.temoins.critique, 'chemin critique, réseau sain').toEqual(['A', 'B', 'C']);
    expect(rompu.temoins.critique, 'chemin critique, réseau rompu').toEqual(['A', 'B']);
    /* DISCRIMINANT 2 — LE PLACEMENT IGNORE BIEN LE LIEN SANS TYPE. Sans ce
       point, l'échec du réseau rompu pourrait venir d'ailleurs que de la
       divergence qu'il met en scène. Passe avant comme après. */
    expect(rompu.temoins.placements.B, 'placement de B par son lien sans type').toBeNull();

    // --- L'ASSERTION CENTRALE ---
    expect(tableau(sain), 'les 14 points, réseau sain').toBe(
        '1:75:alerte 2:0:ok 3:50:alerte 4:100:ok 5:—:sans-objet 6:0:ok 7:—:na '
        + '8:0:ok 9:3:alerte 10:100:info 11:—:na 12:602:ok 13:—:na 14:—:na');
    expect(sain.rapport.points[11]).toMatchObject({ cibleId: 'A', retard: 600 });
    expect(rompu.rapport.points[11]).toMatchObject({ valeur: 0, etat: 'alerte', cibleId: 'A', fautives: ['A'] });
    expect(rompu.rapport.anomalies.liensSansType).toEqual([{ tacheId: 'B', versId: 'A' }]);
});
