/* ============================================================
   CONTROLE DCMA 14 POINTS — module de calcul PUR

   Source : DCMA-EA PAM 200.1, « EVMS Program Analysis Pamphlet »,
   10 juillet 2012, section 4 (« 14 Point Schedule Metrics for IMS »),
   et ses paragraphes 3.1.2.3 (CPLI) et 3.1.2.4 (BEI).

   CE SONT DES SIGNAUX, PAS UN VERDICT. Le PAM le dit lui-meme : un
   indicateur au rouge « n'est pas en soi synonyme d'echec ». L'etat
   rendu ici est donc 'ok' ou 'alerte', jamais 'reussi' ou 'echoue' —
   sauf pour le point 12, qui est un test et non un ratio.

   PUR, ET C'EST DELIBERE. Ce module ne depend que de utils.js : il ne lit
   ni le store, ni le DOM, ni Supabase. Tout ce qu'il mesure lui est passe
   en argument. Il s'importe donc tel quel dans la page — c'est ainsi que
   les tests E2E le mesurent sur des plannings construits pour l'occasion —
   et il ne peut rien ecrire en base, meme par accident.

   LA MARGE N'EST PAS RECALCULEE ICI. Elle vient de store.analyzeNetwork(),
   qui est le calcul meme du chemin critique. Le commentaire de
   getCriticalPath() raconte trois divergences entre deux implementations
   d'une meme regle (#56, #57, #66) : il n'y en aura pas de quatrieme.

   UNITES. Les seuils de 44 jours sont des jours OUVRES du calendrier
   (PAM 4.6 et 4.8), jamais « deux mois » ni soixante jours calendaires.
   Les decalages des liens sont, eux, en jours CALENDAIRES : ils ne sont
   ici que comptes selon leur signe, jamais convertis.

   POPULATION. Le PAM compte des « taches incompletes » ; le cours DCMA en
   exclut les recapitulatives, les jalons et les taches terminees. Ici :
   ni phase, ni jalon, avancement < 100 %. « Terminee » veut dire
   avancement >= 100 %, comme l'alerte de retard existante.
   ============================================================ */

import { workingDaysBetween, addWorkingDays, formatDateISO } from './utils.js';

/** PAM 4.6 et 4.8 : « 44 working days (2 months) ». */
export const SEUIL_JOURS_OUVRES = 44;

/** Retard injecte par le test du chemin critique (point 12). Le cours DCMA
 *  de 2009 porte la duree restante d'une tache critique a 600 jours ouvres :
 *  assez pour qu'aucun autre chemin ne puisse masquer son effet. */
export const RETARD_TEST_CHEMIN = 600;

/** Ecart tolere, en jours ouvres, entre le retard injecte et le recul de la
 *  fin du projet. Les decalages des liens courent en jours CALENDAIRES et
 *  sont recales sur le jour ouvre suivant : un lien a decalage peut gagner
 *  ou perdre un jour d'alignement quand on le translate. Une logique rompue,
 *  elle, ne fait pas reculer la fin du tout. */
export const TOLERANCE_TEST_CHEMIN = 10;

const estPhase   = (t) => !!t.isPhase;
const estJalon   = (t) => !!t.isMilestone;
const estPermis  = (t) => !!t.isPermit;
const avancement = (t) => Number(t.progress) || 0;
const terminee   = (t) => avancement(t) >= 100;

/** Plus grande date ISO d'une liste (les chaines ISO se comparent comme des
 *  dates). */
const maxIso = (dates) => dates.reduce((m, d) => (d && (m === null || d > m)) ? d : m, null);

/** Ecart SIGNE en jours ouvres de `de` a `a` : 0 pour deux dates egales,
 *  positif si `a` est plus tard. workingDaysBetween() compte l'intervalle
 *  FERME et rend 0 quand les dates sont inversees : le signe se gere ici. */
function ecartOuvre(de, a, cal) {
    if (!de || !a || de === a) return 0;
    return a > de
        ? workingDaysBetween(de, a, cal) - 1
        : -(workingDaysBetween(a, de, cal) - 1);
}

/** Duree en jours ouvres, bornes incluses, minimum 1 — la regle du moteur
 *  (store.js, _computeConstrainedDates et getCriticalPath). */
const dureeOuvree = (debut, fin, cal) => Math.max(1, workingDaysBetween(debut, fin, cal) || 1);

const pourcent = (n, d) => Math.round((n / d) * 1000) / 10;
const arrondi2 = (x) => Math.round(x * 100) / 100;

/** Etat d'une mesure par rapport a son seuil. */
function etatSeuil(valeur, seuil) {
    if (valeur === null) return 'na';
    return seuil.op === '<=' ? (valeur <= seuil.valeur ? 'ok' : 'alerte')
                             : (valeur >= seuil.valeur ? 'ok' : 'alerte');
}

/** Point a ratio : numerateur / denominateur, en pourcentage. */
function pointPourcent(n, cle, fautives, denominateur, seuil, extra = {}) {
    if (!denominateur) {
        return { n, cle, valeur: null, unite: '%', numerateur: 0, denominateur: 0,
                 seuil, etat: 'na', raison: 'aucune-tache', fautives: [], ...extra };
    }
    const valeur = pourcent(fautives.length, denominateur);
    return { n, cle, valeur, unite: '%', numerateur: fautives.length, denominateur,
             seuil, etat: extra.etat || etatSeuil(valeur, seuil), fautives, ...extra };
}

/** Rejoue le placement des taches sur une COPIE, en ordre topologique, avec
 *  la fonction de placement du moteur. Iteratif, sans recursion :
 *  propagateDependencies() deborde la pile au-dela de quelques milliers de
 *  taches en chaine. Rien n'est ecrit ailleurs que dans la copie.
 *
 *  Rend la fin du projet SANS LA TACHE RETARDEE : sa propre fin recule
 *  toujours du retard, par construction. Ce qui se mesure, c'est que le
 *  retard se PROPAGE par les liens jusqu'a la fin — ce que le PAM lit sur
 *  le jalon de fin, que ce modele n'a pas. */
function rejouerPlacement(taches, placer, cibleId, retard, cal) {
    const copie = new Map(taches.map(t => [t.id, { ...t }]));
    if (cibleId && retard > 0) {
        const c = copie.get(cibleId);
        c.endDate = formatDateISO(addWorkingDays(c.endDate, retard, cal));
    }
    const getTask = (id) => copie.get(id);

    // Graphe : predecesseur -> successeur, et enfant -> phase parente.
    const entrants = new Map(taches.map(t => [t.id, 0]));
    const sortants = new Map(taches.map(t => [t.id, []]));
    const arc = (de, vers) => {
        if (!copie.has(de) || !copie.has(vers) || de === vers) return;
        sortants.get(de).push(vers);
        entrants.set(vers, entrants.get(vers) + 1);
    };
    taches.forEach(t => {
        (t.dependencies || []).forEach(d => arc(d.taskId, t.id));
        if (t.parentId) arc(t.id, t.parentId);
    });
    const ordre = [];
    const file = taches.filter(t => entrants.get(t.id) === 0).map(t => t.id);
    while (file.length) {
        const id = file.shift();
        ordre.push(id);
        sortants.get(id).forEach(v => {
            entrants.set(v, entrants.get(v) - 1);
            if (entrants.get(v) === 0) file.push(v);
        });
    }
    // Un cycle ne devrait pas exister (findAllCycles l'empeche) : ses noeuds
    // gardent leurs dates.

    const enfants = new Map();
    taches.forEach(t => {
        if (t.parentId) {
            if (!enfants.has(t.parentId)) enfants.set(t.parentId, []);
            enfants.get(t.parentId).push(t.id);
        }
    });
    ordre.forEach(id => {
        const t = copie.get(id);
        if (estPhase(t)) {
            const ks = (enfants.get(id) || []).map(getTask).filter(Boolean);
            if (ks.length) {
                t.startDate = ks.reduce((m, k) => (k.startDate < m ? k.startDate : m), ks[0].startDate);
                t.endDate   = maxIso(ks.map(k => k.endDate));
            }
            return;
        }
        const place = placer(t, getTask);
        if (place) { t.startDate = place.startDate; t.endDate = place.endDate; }
    });
    return maxIso([...copie.values()].filter(t => !estPhase(t) && t.id !== cibleId).map(t => t.endDate));
}

/**
 * Evalue les 14 points sur un projet.
 *
 * @param {object}   entree
 * @param {object[]} entree.taches      toutes les taches du projet, phases comprises
 * @param {object}   entree.calendrier  calendrier ouvre (utils.defaultCalendar() et reglages)
 * @param {string}   entree.dateEtat    'AAAA-MM-JJ'
 * @param {string}  [entree.sourceDateEtat]  'aujourdhui' ou 'projet'
 * @param {string}  [entree.echeance]   'AAAA-MM-JJ' ou null
 * @param {object}  [entree.baseline]   { tasks: [{ id, startDate, endDate }] } ou null
 * @param {object}   entree.analyse     store.analyzeNetwork() : { critical, float }
 * @param {Function}[entree.placer]     (tache, getTask) => {startDate, endDate}|null
 */
export function evaluerDcma(entree) {
    const {
        taches = [], calendrier: cal, dateEtat, sourceDateEtat = 'aujourdhui',
        echeance = null, baseline = null, analyse = { critical: [], float: {} }, placer = null,
    } = entree;

    const parId = new Map(taches.map(t => [t.id, t]));
    const nonPhases = taches.filter(t => !estPhase(t));

    /* ---- Liens : valides, et anomalies ----
       Un lien est porte par le SUCCESSEUR (task.dependencies). Il n'est
       valide que s'il vise une tache existante du projet qui n'est pas une
       phase : un lien vers une tache supprimee survit dans dependencies
       (deleteTask ne nettoie pas), et un lien vers une phase est honore par
       le placement mais ignore par le chemin critique. */
    const anomalies = { liensFantomes: [], liensVersPhase: [], liensSansType: [], margesNegatives: [] };
    const liens = [];
    const nbPred = new Map(), nbSucc = new Map();
    nonPhases.forEach(t => { nbPred.set(t.id, 0); nbSucc.set(t.id, 0); });
    nonPhases.forEach(succ => {
        (succ.dependencies || []).forEach(dep => {
            const pred = parId.get(dep.taskId);
            if (!pred) { anomalies.liensFantomes.push({ tacheId: succ.id, versId: dep.taskId }); return; }
            if (estPhase(pred)) { anomalies.liensVersPhase.push({ tacheId: succ.id, versId: pred.id }); return; }
            if (!dep.type) anomalies.liensSansType.push({ tacheId: succ.id, versId: pred.id });
            liens.push({ pred, succ, type: dep.type || 'FS', lag: Number(dep.lag) || 0 });
            nbPred.set(succ.id, nbPred.get(succ.id) + 1);
            nbSucc.set(pred.id, nbSucc.get(pred.id) + 1);
        });
    });

    // Population de base : ni phase, ni jalon, incomplete.
    const P = nonPhases.filter(t => !estJalon(t) && !terminee(t));
    const enP = new Set(P.map(t => t.id));
    const ids = (ts) => ts.map(t => t.id);
    const uniques = (xs) => [...new Set(xs)];

    // Liens des taches incompletes : ceux dont le successeur est dans P.
    const liensP = liens.filter(l => enP.has(l.succ.id));

    const points = [];

    // 1 — Logique.
    points.push(pointPourcent(1, 'logique',
        ids(P.filter(t => nbPred.get(t.id) === 0 || nbSucc.get(t.id) === 0)),
        P.length, { op: '<=', valeur: 5 }));

    // 2 — Avances (decalage negatif). Le PAM compte des LIENS.
    points.push(pointPourcent(2, 'avances',
        uniques(liensP.filter(l => l.lag < 0).map(l => l.succ.id)),
        liensP.length, { op: '<=', valeur: 0 },
        { numerateurLiens: liensP.filter(l => l.lag < 0).length }));
    // 3 — Decalages positifs.
    points.push(pointPourcent(3, 'retards',
        uniques(liensP.filter(l => l.lag > 0).map(l => l.succ.id)),
        liensP.length, { op: '<=', valeur: 5 },
        { numerateurLiens: liensP.filter(l => l.lag > 0).length }));
    /* Pour 2 et 3, la valeur porte sur les LIENS ; les « fautives » sont les
       taches qui les portent, pour pouvoir les montrer. */
    [points[1], points[2]].forEach(p => {
        if (p.denominateur) {
            p.numerateur = p.numerateurLiens;
            p.valeur = pourcent(p.numerateurLiens, p.denominateur);
            p.etat = etatSeuil(p.valeur, p.seuil);
        }
        delete p.numerateurLiens;
    });

    // 4 — Part des liens Fin->Debut.
    {
        const fs = liensP.filter(l => l.type === 'FS').length;
        const p = pointPourcent(4, 'typesLiens',
            uniques(liensP.filter(l => l.type !== 'FS').map(l => l.succ.id)),
            liensP.length, { op: '>=', valeur: 90 });
        if (p.denominateur) {
            p.numerateur = fs;
            p.valeur = pourcent(fs, p.denominateur);
            p.etat = etatSeuil(p.valeur, p.seuil);
        }
        points.push(p);
    }

    // 5 — Contraintes dures : le modele n'en porte aucune.
    points.push({ n: 5, cle: 'contraintes', valeur: null, unite: '%', numerateur: 0, denominateur: P.length,
                  seuil: { op: '<=', valeur: 5 }, etat: 'sans-objet', raison: 'sans-contraintes', fautives: [] });

    /* 6 et 7 — Marges. La marge vient du chemin critique, en jours ouvres,
       mesuree contre la fin PREVUE du projet. Avec une echeance, elle se
       mesure contre l'echeance : toutes les marges se translatent du meme
       ecart, puisque la passe arriere part d'une borne commune. */
    const finPrevue = maxIso(nonPhases.map(t => t.endDate));
    const translation = echeance && finPrevue ? ecartOuvre(finPrevue, echeance, cal) : 0;
    const marge = (t) => {
        const m = analyse.float ? analyse.float[t.id] : undefined;
        return m === undefined ? null : m + translation;
    };
    const avecMarge = P.filter(t => marge(t) !== null);
    points.push(pointPourcent(6, 'margeElevee',
        ids(avecMarge.filter(t => marge(t) > SEUIL_JOURS_OUVRES)),
        avecMarge.length, { op: '<=', valeur: 5 }));
    if (echeance) {
        points.push(pointPourcent(7, 'margeNegative',
            ids(avecMarge.filter(t => marge(t) < 0)),
            avecMarge.length, { op: '<=', valeur: 0 }));
    } else {
        points.push({ n: 7, cle: 'margeNegative', valeur: null, unite: '%', numerateur: 0, denominateur: avecMarge.length,
                      seuil: { op: '<=', valeur: 0 }, etat: 'na', raison: 'sans-echeance', fautives: [] });
        // Sans echeance, une marge negative ne vient que de liens incoherents.
        anomalies.margesNegatives = ids(nonPhases.filter(t => analyse.float && analyse.float[t.id] < 0));
    }

    /* 8 — Duree elevee. Le PAM mesure la duree de BASELINE quand elle existe.
       Les permis sont exclus : leur duree est celle d'une instruction legale. */
    const parBaseline = new Map(((baseline && baseline.tasks) || []).map(b => [b.id, b]));
    const P8 = P.filter(t => !estPermis(t));
    points.push(pointPourcent(8, 'dureeElevee',
        ids(P8.filter(t => {
            const b = parBaseline.get(t.id);
            return dureeOuvree(b ? b.startDate : t.startDate, b ? b.endDate : t.endDate, cal) > SEUIL_JOURS_OUVRES;
        })),
        P8.length, { op: '<=', valeur: 5 }));

    /* 9 — Dates invalides, par rapport a la date d'etat. Sans dates reelles,
       l'avancement en tient lieu : une tache commencee dont le debut est
       dans le futur porte une date « reelle » future. */
    const approcheDate = sourceDateEtat === 'aujourdhui' ? ['date-etat-aujourdhui'] : [];
    {
        const fautives = ids(P.filter(t =>
            (t.endDate && t.endDate < dateEtat)
            || (avancement(t) === 0 && t.startDate && t.startDate < dateEtat)
            || (avancement(t) > 0 && t.startDate && t.startDate > dateEtat)));
        points.push({ n: 9, cle: 'datesInvalides', valeur: P.length ? fautives.length : null, unite: 'nombre',
                      numerateur: fautives.length, denominateur: P.length, seuil: { op: '<=', valeur: 0 },
                      etat: P.length ? etatSeuil(fautives.length, { op: '<=', valeur: 0 }) : 'na',
                      raison: P.length ? undefined : 'aucune-tache',
                      approche: ['sans-dates-reelles', ...approcheDate], fautives });
    }

    /* 10 — Ressources. Le PAM vise « des montants ou des heures » : une tache
       affectee ou portant un cout fixe est chargee. Point informatif, sans
       seuil dans le PAM. Permis exclus : une attente administrative. */
    {
        const P10 = P.filter(t => !estPermis(t));
        const chargee = (t) => (t.assignees || []).length > 0
            || (t.fixedCosts || []).some(c => Number(c && c.amount) > 0);
        const p = pointPourcent(10, 'ressources', ids(P10.filter(t => !chargee(t))), P10.length,
            { op: '<=', valeur: null }, { etat: 'info' });
        if (!p.denominateur) p.etat = 'na';
        points.push(p);
    }

    /* 11 — Taches manquees, contre la baseline. Denominateur : les taches dont
       la fin de baseline est a la date d'etat ou avant. Une tache est manquee
       si sa fin (reelle ou prevue) depasse sa fin de baseline. Sans date
       reelle, la fin d'une tache terminee est sa date de fin ; celle d'une
       tache incomplete ne peut pas preceder la date d'etat. */
    const blEchues = baseline ? baseline.tasks.filter(b => b.endDate && b.endDate <= dateEtat)
        .map(b => ({ b, t: parId.get(b.id) }))
        .filter(({ t }) => t && !estPhase(t) && !estJalon(t)) : [];
    if (!baseline) {
        points.push({ n: 11, cle: 'tachesManquees', valeur: null, unite: '%', numerateur: 0, denominateur: 0,
                      seuil: { op: '<=', valeur: 5 }, etat: 'na', raison: 'sans-baseline', fautives: [] });
    } else {
        const fautives = blEchues.filter(({ b, t }) => {
            const fin = terminee(t) ? t.endDate : maxIso([t.endDate, dateEtat]);
            return fin > b.endDate;
        }).map(({ t }) => t.id);
        points.push(pointPourcent(11, 'tachesManquees', fautives, blEchues.length, { op: '<=', valeur: 5 },
            { approche: ['sans-dates-reelles', ...approcheDate] }));
    }

    /* 12 — Test du chemin critique. On retarde une tache critique incomplete
       qui a des successeurs — la plus precoce —, on rejoue le placement sur
       une copie, et la fin du projet, mesuree sans cette tache, doit reculer
       d'autant. Les deux rejeux (sans et avec retard) passent par le meme
       code : seul le retard les distingue. */
    {
        const critiques = new Set(analyse.critical || []);
        const candidates = P.filter(t => critiques.has(t.id) && nbSucc.get(t.id) > 0)
            .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
        if (!placer) {
            points.push({ n: 12, cle: 'testChemin', valeur: null, unite: 'test', etat: 'na', raison: 'sans-moteur', fautives: [] });
        } else if (!candidates.length) {
            points.push({ n: 12, cle: 'testChemin', valeur: null, unite: 'test', etat: 'na', raison: 'aucune-tache-critique-reliee', fautives: [] });
        } else {
            const cible = candidates[0];
            const fin0 = rejouerPlacement(taches, placer, cible.id, 0, cal);
            const finN = rejouerPlacement(taches, placer, cible.id, RETARD_TEST_CHEMIN, cal);
            const recul = ecartOuvre(fin0, finN, cal);
            const reussi = recul >= RETARD_TEST_CHEMIN - TOLERANCE_TEST_CHEMIN;
            points.push({ n: 12, cle: 'testChemin', valeur: recul, unite: 'test',
                          retard: RETARD_TEST_CHEMIN, cibleId: cible.id,
                          etat: reussi ? 'ok' : 'alerte', fautives: reussi ? [] : [cible.id] });
        }
    }

    /* 13 — CPLI = (CPL + TF) / CPL. CPL : jours ouvres de la date d'etat a la
       fin prevue. TF : marge de la fin prevue sur la cible — l'echeance, ou a
       defaut la fin de la baseline (approche). */
    {
        const finBaseline = baseline
            ? maxIso(baseline.tasks.filter(b => { const t = parId.get(b.id); return t && !estPhase(t); }).map(b => b.endDate))
            : null;
        const cible = echeance || finBaseline;
        const cpl = finPrevue ? workingDaysBetween(dateEtat, finPrevue, cal) : 0;
        if (!cible) {
            points.push({ n: 13, cle: 'cpli', valeur: null, unite: 'ratio', seuil: { op: '>=', valeur: 0.95 },
                          etat: 'na', raison: 'sans-cible', fautives: [] });
        } else if (cpl <= 0) {
            points.push({ n: 13, cle: 'cpli', valeur: null, unite: 'ratio', seuil: { op: '>=', valeur: 0.95 },
                          etat: 'na', raison: 'fin-passee', fautives: [] });
        } else {
            const tf = ecartOuvre(finPrevue, cible, cal);
            const valeur = arrondi2((cpl + tf) / cpl);
            points.push({ n: 13, cle: 'cpli', valeur, unite: 'ratio', seuil: { op: '>=', valeur: 0.95 },
                          etat: etatSeuil(valeur, { op: '>=', valeur: 0.95 }),
                          cpl, tf, cible, finPrevue, fautives: [],
                          approche: [...(echeance ? [] : ['cible-baseline']), ...approcheDate] });
        }
    }

    /* 14 — BEI = taches terminees / taches qui devaient l'etre. Le PAM
       (3.1.2.4) ajoute au denominateur les taches sans fin de baseline —
       ici, celles creees apres la capture. Le numerateur compte TOUTES les
       taches terminees, avances comprises : le BEI peut depasser 1. */
    if (!baseline) {
        points.push({ n: 14, cle: 'bei', valeur: null, unite: 'ratio', seuil: { op: '>=', valeur: 0.95 },
                      etat: 'na', raison: 'sans-baseline', fautives: [] });
    } else {
        const reelles = nonPhases.filter(t => !estJalon(t));
        const absentes = reelles.filter(t => !parBaseline.has(t.id));
        const denominateur = blEchues.length + absentes.length;
        const faites = reelles.filter(terminee).length;
        if (!denominateur) {
            points.push({ n: 14, cle: 'bei', valeur: null, unite: 'ratio', seuil: { op: '>=', valeur: 0.95 },
                          etat: 'na', raison: 'aucune-tache', fautives: [] });
        } else {
            const valeur = arrondi2(faites / denominateur);
            points.push({ n: 14, cle: 'bei', valeur, unite: 'ratio', numerateur: faites, denominateur,
                          seuil: { op: '>=', valeur: 0.95 }, etat: etatSeuil(valeur, { op: '>=', valeur: 0.95 }),
                          fautives: blEchues.filter(({ t }) => !terminee(t)).map(({ t }) => t.id),
                          approche: ['sans-dates-reelles', ...approcheDate] });
        }
    }

    return {
        dateEtat, sourceDateEtat, echeance, finPrevue,
        calendrier: cal,
        avecBaseline: !!baseline,
        population: P.length,
        liens: liens.length,
        points,
        anomalies,
        permisExclus: ids(P.filter(estPermis)),
    };
}
