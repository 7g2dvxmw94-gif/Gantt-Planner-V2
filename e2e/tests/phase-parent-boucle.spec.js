import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § B2 (phases), quatrième angle après phase.spec.js,
 * phase-fuseau-ouest.spec.js et phase-enfant-sans-dates.spec.js : le
 * RATTACHEMENT d'une phase à une autre phase.
 *
 * LE DÉFAUT : une phase peut être rattachée à l'une de ses propres
 * descendantes, ce qui ferme une boucle dans l'arbre des tâches. La fiche
 * (task-modal.js, _populateParents) propose comme « Phase parente » toutes
 * les phases du projet sauf la tâche elle-même, et store.updateTask() écrit
 * le parentId qu'on lui donne sans rien vérifier.
 *
 * MESURÉ dans la page, sur le vrai store, la vraie fiche et le vrai rendu
 * du Gantt, avec l'arbre de ce fichier — A ⊃ B ⊃ C ⊃ T, et D ⊃ E à part :
 *   - la fiche de A propose B et C. Choisir C puis enregistrer : updateTask
 *     accepte, la fiche se ferme, et A partirait en base sous C ;
 *   - getTaskTree(), d'où le Gantt tire ses lignes, passe alors de six
 *     tâches à deux : A, B, C et T DISPARAISSENT, aucune n'ayant plus de
 *     chemin vers une racine. Aucune récursion infinie : la boucle est hors
 *     de portée de tout parcours qui part des racines. Le chargement d'un
 *     projet (_loadProjectData) les reprend telles quelles, toujours
 *     absentes ;
 *   - l'export CSV perd A et B. C et T en sont absentes même sans boucle :
 *     cet export s'arrête à deux niveaux, un défaut distinct, hors de ce
 *     fichier ;
 *   - deleteTask(A) sur la boucle A ⇄ B lève « RangeError: Maximum call
 *     stack size exceeded », et aucune tâche n'est supprimée ;
 *   - _recalculatePhase() termine : il ne remonte pas les parents ;
 *   - le store accepte jusqu'à D sous D, que la fiche ne propose pas.
 *
 * LA FICHE N'EST PAS LA SEULE ENTRÉE. Le glisser-déposer
 * (gantt-interactions.js, _applyVerticalDrop) a sa propre garde,
 * _isDescendant, et refuse bien de déposer A dans C — mais il ne l'applique
 * qu'à une PHASE déplacée. Or une phase changée en tâche par la fiche garde
 * ses enfants (mesuré : B devenue tâche, C reste sous B) ; déposée dans C,
 * elle ferme la boucle B ⇄ C (mesuré aussi).
 *
 * POURQUOI UN TEST AU NIVEAU DES MODULES, et non un test d'interface : la
 * fiche et le glisser-déposer écrivent tous deux par updateTask, et c'est
 * là que la boucle doit être refusée. Un test qui ne lirait que la liste de
 * la fiche passerait sur un correctif qui ne garderait que la fiche.
 * L'assertion centrale porte donc sur les deux : ce que la fiche propose,
 * et ce que le store accepte. Elle descend à deux niveaux (C est la
 * petite-fille de A) : une garde qui n'écarterait que les enfants directs
 * laisserait passer C. Et elle fait intervenir une EX-PHASE — B changée en
 * tâche, qui garde C — des deux côtés :
 *   - dans le store, l'ex-phase B est rattachée à C. C'est le chemin du
 *     glisser-déposer : sans ce cas, une garde du store limitée aux phases,
 *     l'angle mort même de _isDescendant, passerait le test (mesuré) ;
 *   - dans la fiche, on ouvre A quand B est une ex-phase. Une fiche qui
 *     n'indexerait que les phases ne verrait plus que C descend de A, par
 *     B, et la proposerait : sans ce cas, elle passerait le test (mesuré).
 *
 * APRÈS L'ASSERTION CENTRALE, UNE GARDE : LA BOUCLE DÉJÀ PRÉSENTE. Pour
 * refuser une boucle, la fiche et le store doivent remonter les parents.
 * Or un projet peut déjà porter une boucle, créée avant ce correctif ou
 * venue d'un import JSON. Sur X ⇄ Y, la fiche de Z doit proposer X et Y, et
 * le store doit accepter Z sous X : la remontée doit s'arrêter sur la
 * boucle au lieu d'y tourner. Une remontée sans ensemble des nœuds vus
 * passe toutes les assertions qui précèdent, car elle ne diffère que sur
 * une boucle (mesuré). Cette garde passe avant comme après le correctif.
 *
 * HORS DE CE TEST : l'import JSON (importProject, importAllProjects) et le
 * chargement d'une boucle déjà en base posent le parentId sans passer par
 * updateTask. Ce test ne les corrige pas et ne répare aucune boucle : la
 * garde ci-dessus vérifie seulement que la nouvelle règle termine sur
 * l'une d'elles.
 *
 * LE MONTAGE, en deux parties, sans aucune écriture qui sorte de la page :
 *   - LA FICHE : le vrai _populateParents, celui du prototype de la fiche,
 *     appelé sur un objet qui ne porte que _editingTaskId et une liste
 *     <select> détachée, jamais insérée dans la page. La fonction lit les
 *     phases par le store de l'application : ses données sont remplacées le
 *     temps de l'appel par celles de ce fichier, modifiées au besoin (B
 *     changée en tâche, pour l'ex-phase), puis rétablies, sans un seul
 *     await entre les deux — aucun autre code de la page ne peut voir
 *     l'échange. L'index des tâches est invalidé ensuite, pour que rien ne
 *     survive de la substitution ;
 *   - LE STORE : le vrai updateTask, celui du prototype du store, appliqué
 *     à un objet moteur neuf qui ne porte que ces tâches, modifiées de même
 *     au besoin. Son _save est neutralisé : le vrai écrirait dans le
 *     localStorage, sous les clés sans compte, un projet actif « P-boucle »
 *     et des préférences vides. Ses deux envois en base : celui de
 *     _recalculatePhase part d'un bouchon posé et retiré sans await ; celui
 *     que updateTask diffère (setTimeout) relit les tâches du moteur au
 *     moment de partir — elles sont vidées avant, il ne trouve rien et
 *     n'envoie rien.
 * Chaque tentative, de la fiche comme du store, relit sur ses PROPRES
 * données, juste avant l'appel mesuré, ce que portent les tâches modifiées
 * (le discriminant 3) : c'est ce montage-là, et non un autre construit à
 * part, qui doit être celui de l'ex-phase.
 * La garde « boucle déjà présente » passe par les deux mêmes parties, sur
 * les tâches de BOUCLE au lieu de celles de TACHES. Une exception levée par
 * l'un de ses deux appels est rattrapée dans la page : l'échec porte alors
 * sur l'assertion de la garde, et non sur page.evaluate.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « rattachement qui fermerait une boucle ». La fiche de A
 * propose B et C en trop, celle de B propose C en trop, celle de A quand B
 * est une ex-phase propose C en trop, et le store accepte les cinq
 * rattachements. La garde qui suit n'est pas atteinte ; elle passerait
 * (mesuré). */

const PROJET = 'P-boucle';
const phase = (id, parentId, order) => ({
    id, name: `Phase ${id}`, projectId: PROJET, parentId, isPhase: true, order,
    startDate: '2026-06-01', endDate: '2026-06-05', progress: 0, dependencies: [],
});
const tache = (id, parentId, order, debut, fin) => ({
    id, name: `Tâche ${id}`, projectId: PROJET, parentId, isPhase: false, order,
    startDate: debut, endDate: fin, progress: 0, dependencies: [],
});
/* A ⊃ B ⊃ C ⊃ T : C est la petite-fille de A. D ⊃ E, sans lien avec A. */
const TACHES = [
    phase('A', null, 0),
    phase('B', 'A', 1),
    phase('C', 'B', 2),
    tache('T', 'C', 3, '2026-06-08', '2026-06-12'),
    phase('D', null, 4),
    tache('E', 'D', 5, '2026-07-06', '2026-07-10'),
];
/* L'ex-phase : B changée en tâche par la fiche. Elle garde C. */
const EX_PHASE = { B: { isPhase: false } };
/* Une boucle DÉJÀ PRÉSENTE, X ⇄ Y, telle qu'un projet peut la porter s'il
   l'a reçue avant ce correctif ou par un import JSON. Z est à part. */
const BOUCLE = [phase('X', 'Y', 0), phase('Y', 'X', 1), phase('Z', null, 2)];

async function mesurer(page) {
    return page.evaluate(async ({ taches, projet, exPhase, boucle }) => {
        const base = document.baseURI;
        const { store } = await import(new URL('js/store.js', base).href);
        const { supabaseStore } = await import(new URL('js/supabase-store.js', base).href);
        const { taskModal } = await import(new URL('js/task-modal.js', base).href);

        /* Les tâches de `liste` (TACHES par défaut, BOUCLE pour la garde),
           chacune modifiée au besoin par `modif` ({ id: champs }). */
        const copie = (modif = {}, liste = taches) => liste.map(t => ({ ...t, dependencies: [], ...modif[t.id] }));

        /* Ce que portent, dans `donnees`, les tâches que `modif` change :
           phase ou non, et leurs enfants directs. Chaque tentative le lit
           sur ses propres données, pour le discriminant 3. */
        const montage = (donnees, modif = {}) => Object.fromEntries(Object.keys(modif).map(id => [id, {
            phase: donnees.find(t => t.id === id).isPhase,
            enfants: donnees.filter(t => t.parentId === id).map(t => t.id),
        }]));

        /* Ce que la fiche de `id` propose comme phase parente, et la valeur
           retenue quand la tâche est sous `parentId`. */
        const populateParents = Object.getPrototypeOf(taskModal)._populateParents;
        const proposees = (id, parentId, modif, liste) => {
            const fiche = { _editingTaskId: id, _parentSelect: document.createElement('select') };
            const vraies = store._data;
            store._data = { ...vraies, settings: { ...vraies.settings, activeProjectId: projet }, tasks: copie(modif, liste) };
            try {
                const lu = montage(store.getTasks(), modif);
                populateParents.call(fiche, parentId);
                return {
                    options: [...fiche._parentSelect.options].map(o => o.value),
                    choisie: fiche._parentSelect.value,
                    montage: lu,
                };
            } finally {
                store._data = vraies;
                store._invalidateTaskIndex();
            }
        };

        /* Un objet moteur neuf, qui ne porte que les tâches de `liste`,
           modifiées au besoin par `modif`. */
        const moteurDe = (modif, liste) => Object.assign(Object.create(Object.getPrototypeOf(store)), {
            _data: { projects: [], settings: { activeProjectId: projet }, tasks: copie(modif, liste) },
            _listeners: new Map(), _undoStack: [], _redoStack: [], _maxHistory: 1,
            _save() {},
        });

        /* Ce que le store fait de « `id` sous `parentId` » : refusé ou non,
           et le parent de `id` après la tentative. Un moteur neuf à chaque
           tentative, pour qu'aucune ne parte de l'état laissé par une autre. */
        const rattacher = (id, parentId, modif, liste) => {
            const moteur = moteurDe(modif, liste);
            const upsertTask = supabaseStore.upsertTask;
            supabaseStore.upsertTask = () => Promise.resolve();
            try {
                const lu = montage(moteur._data.tasks, modif);
                const retour = moteur.updateTask(id, { parentId });
                return {
                    refus: retour === null,
                    parent: moteur._data.tasks.find(t => t.id === id).parentId,
                    montage: lu,
                };
            } finally {
                moteur._data.tasks = [];
                supabaseStore.upsertTask = upsertTask;
            }
        };

        /* Pour la garde : une exception levée par l'appel devient l'issue
           du cas, sous son nom. L'échec porte alors sur l'assertion de la
           garde, et non sur page.evaluate. Les `finally` de proposees et de
           rattacher ont déjà tout rétabli quand elle arrive ici. */
        const rattrape = (appel) => {
            try { return appel(); } catch (erreur) { return erreur.name; }
        };

        return {
            fiche: {
                T: proposees('T', 'C'), D: proposees('D', null),
                A: proposees('A', null), B: proposees('B', 'A'),
                'A ex-phase': proposees('A', null, exPhase),
            },
            store: {
                'D sous C': rattacher('D', 'C'), 'T sous A': rattacher('T', 'A'),
                'A sous B': rattacher('A', 'B'), 'A sous C': rattacher('A', 'C'),
                'A sous A': rattacher('A', 'A'), 'B sous C': rattacher('B', 'C'),
                'ex-phase B sous C': rattacher('B', 'C', exPhase),
            },
            /* Sur X ⇄ Y : la fiche de Z, et Z rattachée à X. */
            boucle: {
                fiche: rattrape(() => proposees('Z', null, {}, boucle).options),
                store: rattrape(() => (rattacher('Z', 'X', {}, boucle).refus ? 'refus' : 'accepte')),
            },
        };
    }, { taches: TACHES, projet: PROJET, exPhase: EX_PHASE, boucle: BOUCLE });
}

/* Les tentatives sans leur montage : ce qu'elles ont proposé ou fait. */
const issues = (tentatives) => Object.fromEntries(
    Object.entries(tentatives).map(([cas, { montage, ...issue }]) => [cas, issue]));

test('une phase ne peut être rattachée ni à elle-même ni à l\'une de ses descendantes', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    const mesure = await mesurer(page);
    const fiche = issues(mesure.fiche);
    const store = issues(mesure.store);

    /* DISCRIMINANT 1 — LA FICHE VOIT LES PHASES DE CE FICHIER. Pour T, une
       tâche sans descendante, elle propose les quatre phases et retient la
       sienne ; pour D, phase sans lien avec A, les trois autres. Ferme deux
       mensonges : une liste vidée par un montage qui ne verrait pas ces
       tâches — l'absence de B et de C dans l'assertion centrale serait
       alors gratuite ; et une garde trop large, qui écarterait toute phase
       prise dans une hiérarchie. Passe avant comme après. */
    expect({ T: fiche.T, D: fiche.D }, 'liste de la fiche hors de toute boucle').toEqual({
        T: { options: ['', 'A', 'B', 'C', 'D'], choisie: 'C' },
        D: { options: ['', 'A', 'B', 'C'], choisie: '' },
    });

    /* DISCRIMINANT 2 — LE MOTEUR ÉCRIT BIEN UN PARENT. D passe sous C, et T
       remonte sous A, son arrière-grand-parent. Ferme deux mensonges : un
       moteur dont updateTask sortirait avant d'écrire (droits, tâche
       introuvable) — le refus central ne prouverait plus rien ; et une
       garde à l'envers, qui chercherait le nouveau parent parmi les
       ANCÊTRES de la tâche plutôt que parmi ses descendantes : elle
       refuserait T sous A. Passe avant comme après. */
    expect({ 'D sous C': store['D sous C'], 'T sous A': store['T sous A'] }, 'rattachements sans boucle')
        .toEqual({
            'D sous C': { refus: false, parent: 'C' },
            'T sous A': { refus: false, parent: 'A' },
        });

    /* DISCRIMINANT 3 — LES DEUX CAS DE L'EX-PHASE PORTENT BIEN UNE TÂCHE
       QUI GARDE SON ENFANT. Lu par la tentative même, sur ses propres
       données, juste avant l'appel : la fiche de « A ex-phase » et le
       moteur de « ex-phase B sous C » voient B en tâche, et C toujours
       sous elle. Ferme un mensonge du montage, où qu'il se loge — la copie
       qui ignorerait la modification, la tentative qui ne la recevrait
       pas : B resterait une phase, chaque cas de l'ex-phase ne serait
       qu'une redite d'un autre (« A », « B sous C »), et une garde limitée
       aux phases passerait. Passe avant comme après. */
    expect({ fiche: mesure.fiche['A ex-phase'].montage, store: mesure.store['ex-phase B sous C'].montage },
        'ex-phase changée en tâche qui garde son enfant').toEqual({
        fiche: { B: { phase: false, enfants: ['C'] } },
        store: { B: { phase: false, enfants: ['C'] } },
    });

    // --- L'ASSERTION CENTRALE : ni la fiche ne propose, ni le store
    //     n'accepte, un rattachement qui fermerait une boucle.
    expect({
        fiche: { A: fiche.A, B: fiche.B, 'A ex-phase': fiche['A ex-phase'] },
        store: {
            'A sous B': store['A sous B'], 'A sous C': store['A sous C'],
            'A sous A': store['A sous A'], 'B sous C': store['B sous C'],
            'ex-phase B sous C': store['ex-phase B sous C'],
        },
    }, 'rattachement qui fermerait une boucle').toEqual({
        fiche: {
            A: { options: ['', 'D'], choisie: '' },
            B: { options: ['', 'A', 'D'], choisie: 'A' },
            'A ex-phase': { options: ['', 'D'], choisie: '' },
        },
        store: {
            'A sous B': { refus: true, parent: null },
            'A sous C': { refus: true, parent: null },
            'A sous A': { refus: true, parent: null },
            'B sous C': { refus: true, parent: 'A' },
            'ex-phase B sous C': { refus: true, parent: 'A' },
        },
    });

    /* GARDE — UNE BOUCLE DÉJÀ PRÉSENTE ARRÊTE LA REMONTÉE. Sur un projet qui
       porte déjà X ⇄ Y, la fiche de Z propose X et Y, et le store accepte Z
       sous X : aucun de ces rattachements ne ferme de boucle par Z. Ferme
       le mensonge d'une garde juste sur tout arbre sain, mais qui
       tournerait sans fin sur une boucle venue de la base : la fiche de
       tout projet qui en porte une se bloquerait, et le store avec elle.
       Une remontée sans ensemble des nœuds vus passe toutes les assertions
       qui précèdent ; ici, la fiche et le store lèvent une RangeError,
       rattrapée dans la page, et l'échec porte sur cette assertion
       (mesuré). Z n'existe que dans BOUCLE : une tentative qui ne
       recevrait pas ces données échouerait ici aussi (mesuré). Passe avant
       comme après le correctif : avant lui, la fiche ne remontait rien et
       le store ne vérifiait rien. */
    expect(mesure.boucle, 'boucle déjà présente').toEqual({ fiche: ['', 'X', 'Y'], store: 'accepte' });
});
