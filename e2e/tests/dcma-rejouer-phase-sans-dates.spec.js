import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle du test du
 * chemin critique — le point 12 du rapport DCMA 14 points.
 *
 * LE DÉFAUT : une tâche sans dates dans une phase fait échouer le test du
 * chemin critique d'une logique saine. Le point 12 retarde une tâche
 * critique et rejoue le placement sur une copie du planning
 * (rejouerPlacement, dans js/dcma.js). Ce rejeu recalcule le début de
 * chaque phase comme le plus petit début de ses enfants, en comparant des
 * chaînes :
 *
 *     t.startDate = ks.reduce((m, k) => (k.startDate < m ? k.startDate : m), ks[0].startDate);
 *
 * La chaîne vide précède toute date ISO : un seul enfant sans dates donne
 * à la phase de la copie un début VIDE — même quand la phase reçue a le
 * sien. La fin, elle, passe par maxIso(), qui écarte les valeurs vides.
 *
 * QUI LIT CE DÉBUT : une tâche liée à la phase en Début→Début ou en
 * Début→Fin. Le moteur de placement, appelé sur la copie, lit une date
 * invalide et place cette tâche au « NaN-NaN-NaN ». Comparée en chaîne,
 * cette valeur passe pour la plus tardive (« N » suit les chiffres) :
 * mesuré en local, la fin du projet vaut « NaN-NaN-NaN » dans les DEUX
 * rejeux, sans retard comme avec 600 jours de retard. Le recul mesuré tombe
 * à 0, le point passe en alerte et désigne comme fautive la tâche retardée,
 * dont le retard se propage pourtant jusqu'à la fin.
 *
 * CE PLANNING N'A RIEN D'EXOTIQUE. Mesuré en local : un fichier MS Project
 * XML portant une récapitulative datée, un enfant sans <Start> ni <Finish>
 * et un <PredecessorLink> de type 3 (Début→Début) vers la récapitulative,
 * passé à importFromMSProjectXML(), donne exactement ce planning — la
 * phase garde le début du fichier —, et l'appel que fait
 * _dcmaPresentation() rend alors le point 12 en alerte, recul 0.
 *
 * _recalculatePhase() (js/store.js) a la même forme et le même défaut ; il
 * est traité à part. Dans le planning principal, la phase REÇUE a un début
 * valide : c'est le rejeu lui-même qui l'efface. Une variante la reçoit
 * SANS début — l'état où _recalculatePhase() la laisse après rechargement :
 * le rejeu, qui recalcule ce début, doit le reconstruire sur ses enfants
 * datés.
 *
 * LE PLANNING PRINCIPAL : la phase PH (K1 datée, K2 sans dates ni liens) ;
 * A → B en Fin→Début, qui porte la fin du projet ; C, liée à PH. A est la
 * seule tâche critique qui ait un successeur — un lien vers une phase ne
 * compte pas : c'est elle que le point 12 retarde. Le moteur est le vrai
 * store, chargé dans la page, appliqué à ces tâches.
 *
 * LES VARIANTES DE L'ASSERTION CENTRALE. Chacune arrête un correctif
 * partiel qui passerait le planning principal :
 *   - K2 AVANT K1 : un minimum filtré mais encore amorcé sur le premier
 *     enfant part de la chaîne vide et n'en sort plus ;
 *   - PH REÇUE SANS DÉBUT : un rejeu qui cesse de recalculer le début des
 *     phases garde ce début vide ;
 *   - CIBLE C : la tâche retardée est elle-même liée à PH en Début→Début
 *     (C → D, D porte la fin). Un maxIso() qui écarterait les dates
 *     illisibles masque le « NaN-NaN-NaN » de C dans le planning principal ;
 *     ici, C puis D tombent au « NaN-NaN-NaN » dans les deux rejeux, et la
 *     fin retombe sur celle de K1 — mesuré en local : 2026-06-05 sans
 *     retard comme avec, recul 0.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « point 12, phase dont un enfant est sans dates ». */

const T = (id, debut, fin, extra = {}) => ({
    id, name: id, startDate: debut, endDate: fin, progress: 0, dependencies: [], ...extra,
});

/* Les dates de C sont celles où le moteur la place pour chaque type de
   lien : elle part du début de PH (SS), finit à ce début (SF) ou suit sa
   fin (FS). */
const DATES_DE_C = {
    SS: ['2026-06-01', '2026-06-03'],
    SF: ['2026-05-28', '2026-06-01'],
    FS: ['2026-06-08', '2026-06-10'],
};

const lienVersPH = (type) => ({ dependencies: [{ taskId: 'PH', type, lag: 0 }] });

/** La phase PH et ses deux enfants, dans l'ordre demandé. */
function phasePH(datesK2, { k2AvantK1 = false, debutPH = '2026-06-01' } = {}) {
    const k1 = T('K1', '2026-06-01', '2026-06-05', { parentId: 'PH' });
    const k2 = T('K2', datesK2[0], datesK2[1], { parentId: 'PH' });
    return [T('PH', debutPH, '2026-06-05', { isPhase: true }), ...(k2AvantK1 ? [k2, k1] : [k1, k2])];
}

/** Cible A : A → B porte la fin ; C, liée à PH, n'a pas de successeur. */
function planning(datesK2, type, options) {
    return [
        ...phasePH(datesK2, options),
        T('A', '2026-06-01', '2026-06-05'),
        T('B', '2026-06-08', '2026-06-12', { dependencies: [{ taskId: 'A', type: 'FS', lag: 0 }] }),
        T('C', DATES_DE_C[type][0], DATES_DE_C[type][1], lienVersPH(type)),
    ];
}

/** Cible C : C, liée à PH en Début→Début, précède D en Fin→Début ; D part
 *  le jour ouvré qui suit la fin de C et finit après K1 : D porte la fin,
 *  et C est la seule tâche qui ait un successeur — c'est elle que le
 *  point 12 retarde.
 *
 *  Début→Début seulement. En Début→Fin, le placement STRICT recale la fin
 *  de C sur le début de PH et absorbe le retard : mesuré en local, le
 *  point 12 y est en alerte, recul 0, même K2 datée, avant comme après le
 *  correctif — ce n'est pas le défaut de ce test. */
function planningCibleC(datesK2) {
    return [
        ...phasePH(datesK2),
        T('C', DATES_DE_C.SS[0], DATES_DE_C.SS[1], lienVersPH('SS')),
        T('D', '2026-06-04', '2026-06-10', { dependencies: [{ taskId: 'C', type: 'FS', lag: 0 }] }),
    ];
}

const K2_DATEE = ['2026-06-02', '2026-06-04'];
const K2_SANS_DATES = ['', ''];

/** Le point 12 de chaque planning, tel que l'application le calcule : le
 *  vrai analyzeNetwork() et le vrai placement, sur ces seules tâches. */
async function point12(page, plannings) {
    return page.evaluate(async (plannings) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const sortie = {};
        for (const [nom, taches] of Object.entries(plannings)) {
            const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
                getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
            });
            const r = evaluerDcma({ taches, calendrier: cal, dateEtat: '2026-05-15',
                analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
            const p = r.points.find(x => x.n === 12);
            sortie[nom] = { etat: p.etat, valeur: p.valeur, cibleId: p.cibleId };
        }
        return sortie;
    }, plannings);
}

/** Où le moteur place C sur le planning TEL QU'IL EST REÇU, sans rejeu. */
async function placementDeC(page, plannings) {
    return page.evaluate(async (plannings) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const cal = utils.defaultCalendar();
        const sortie = {};
        for (const [nom, taches] of Object.entries(plannings)) {
            const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), { _getCalendar: () => cal });
            const getTask = (id) => taches.find(t => t.id === id);
            sortie[nom] = moteur.computeConstrainedDatesIn(getTask('C'), getTask);
        }
        return sortie;
    }, plannings);
}

test('DCMA : une tâche sans dates dans une phase ne fait pas échouer le test du chemin critique', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT 1 — LE PLANNING REÇU EST SAIN, ET LE MOTEUR Y PLACE C SUR
       LA PHASE. Sans ce point, l'alerte du planning principal pourrait venir
       de l'entrée — un placement déjà invalide hors de tout rejeu — et non
       du rejeu. Passe avant comme après. */
    expect(await placementDeC(page, { SS: planning(K2_SANS_DATES, 'SS'), SF: planning(K2_SANS_DATES, 'SF') }),
        'placement de C sur le planning reçu, K2 sans dates').toEqual({
        SS: { startDate: '2026-06-01', endDate: '2026-06-03' },
        SF: { startDate: '2026-05-28', endDate: '2026-06-01' },
    });

    /* DISCRIMINANT 2 — LA RÉFÉRENCE : K2 DATÉE, le point 12 réussit, la tâche
       retardée de 600 jours ouvrés recule la fin de 600 — A dans le planning
       principal, dans les deux ordres des enfants ; C quand elle est la
       cible. Sans ce point, l'alerte pourrait venir du lien vers une phase
       lui-même — placement ou rapport —, de l'ordre des enfants ou du choix
       de la cible, et non de la date vide ; et l'égalité centrale pourrait
       comparer deux résultats également faux. Passe avant comme après. */
    const reference = await point12(page, {
        SS: planning(K2_DATEE, 'SS'),
        SF: planning(K2_DATEE, 'SF'),
        'SS, K2 avant K1': planning(K2_DATEE, 'SS', { k2AvantK1: true }),
        'SF, K2 avant K1': planning(K2_DATEE, 'SF', { k2AvantK1: true }),
        'SS, cible C': planningCibleC(K2_DATEE),
    });
    const OK_A = { etat: 'ok', valeur: 600, cibleId: 'A' };
    const OK_C = { etat: 'ok', valeur: 600, cibleId: 'C' };
    expect(reference, 'point 12, K2 datée').toEqual({
        SS: OK_A, SF: OK_A, 'SS, K2 avant K1': OK_A, 'SF, K2 avant K1': OK_A, 'SS, cible C': OK_C,
    });

    /* DISCRIMINANT 3 — K2 SANS DATES, MAIS C LIÉE À LA FIN DE PH (Fin→Début) :
       le point 12 réussit. Sans ce point, la date vide de K2 pourrait fausser
       le point 12 par un autre chemin — choix de la tâche retardée, analyse
       du réseau, fin de la phase — et le défaut ne serait pas celui du début
       de phase. Passe avant comme après. */
    expect(await point12(page, { FS: planning(K2_SANS_DATES, 'FS') }), 'point 12, K2 sans dates, lien Fin→Début')
        .toEqual({ FS: OK_A });

    /* --- L'ASSERTION CENTRALE : K2 sans dates ne change rien au point 12.
       Chaque variante est comparée à sa référence datée. La phase reçue sans
       début l'est à celle du planning principal : le rejeu recalcule ce
       début, le début reçu ne doit pas compter. */
    expect(await point12(page, {
        SS: planning(K2_SANS_DATES, 'SS'),
        SF: planning(K2_SANS_DATES, 'SF'),
        'SS, K2 avant K1': planning(K2_SANS_DATES, 'SS', { k2AvantK1: true }),
        'SF, K2 avant K1': planning(K2_SANS_DATES, 'SF', { k2AvantK1: true }),
        'SS, PH reçue sans début': planning(K2_SANS_DATES, 'SS', { debutPH: '' }),
        'SF, PH reçue sans début': planning(K2_SANS_DATES, 'SF', { debutPH: '' }),
        'SS, cible C': planningCibleC(K2_SANS_DATES),
    }), 'point 12, phase dont un enfant est sans dates').toEqual({
        ...reference,
        'SS, PH reçue sans début': reference.SS,
        'SF, PH reçue sans début': reference.SF,
    });
});
