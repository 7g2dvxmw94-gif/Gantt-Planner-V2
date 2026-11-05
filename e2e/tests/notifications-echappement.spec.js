import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Le panneau des notifications et les alertes du tableau de bord, et ce
 * qu'ils font des noms qu'ils affichent.
 *
 * LE DÉFAUT : les deux surfaces lisent la même liste, _getNotifications()
 * (app.js), et en insèrent les champs text et sub par innerHTML, sans
 * échappement :
 *
 *     _toggleNotifPanel()   `<div class="notif-text">${n.text}` …
 *                           `<div class="notif-sub">${n.sub}</div>`
 *     _renderDashboard()    `<span style="flex:1;">${n.text}` … `- ${n.sub}`
 *
 * Pour une notification Supabase, text est n.message, que rédigent les RPC
 * notify_task_deleted, notify_project_shared et notify_project_removed
 * (migrations 008, 009 et 011) avec le nom de l'acteur
 * (profiles.full_name, ou à défaut son e-mail) et celui du projet ou de la
 * tâche ; sub est le nom du projet, tiré de task_name ou du projet chargé.
 * Pour une alerte locale (retard, jalon, permis), text porte le nom d'une
 * tâche et sub celui du projet. Dans un projet partagé, tous ces noms sont
 * écrits par UN AUTRE COMPTE : faute d'échappement, ce qu'un compte écrit
 * devient du balisage dans la page d'un autre.
 *
 * UN BALISAGE VOULU À PRÉSERVER : deux alertes locales portent un <strong>
 * écrit par l'application — « Jalon <strong>{name}</strong> » (i18n) et
 * « Budget <strong>…</strong> ». Échapper text à l'insertion le
 * détruirait : un discriminant y veille.
 *
 * Comme pour la popup de partage, le test n'écrit AUCUNE charge active :
 * des balises inertes, <i> et <b>, suffisent à montrer que le nom n'arrive
 * pas intact.
 *
 * RIEN N'EST ÉCRIT DANS LE COMPTE PARTAGÉ. Aucune notification réelle,
 * aucun projet, aucune tâche : le test appelle les vraies méthodes, sur
 * window.app, avec des données fabriquées ici. Il remplace par des
 * bouchons trois LECTURES du store (getProjects, getTasks, getTaskCosts) et
 * la liste app._supabaseNotifs, le temps d'un seul bloc SYNCHRONE — rendu
 * du panneau, rendu du tableau de bord, retrait des bouchons dans un
 * finally, puis relevé du DOM. Aucun autre code de la page ne peut
 * s'exécuter au milieu : ni un événement temps réel, ni un rafraîchissement
 * du tableau de bord, ni une écriture. Les deux rendus, eux, ne font que
 * lire le store et poser du DOM. Les notifications fabriquées n'ont pas
 * d'id : aucune ne désigne une ligne réelle.
 *
 * SIX NOTIFICATIONS, parce que _getNotifications() a six branches qui
 * produisent text et sub : deux notifications Supabase — project_shared,
 * dont le sous-titre vient de task_name, et task_deleted, dont le
 * sous-titre vient du projet chargé —, un retard, un jalon, un permis
 * (store.getPermitNotifications, réel, lit les tâches fabriquées) et un
 * budget. Corriger une branche sans les autres laisserait le défaut en
 * place.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — des balises <i> et <b> nées des noms dans les deux surfaces,
 * là où il n'en faut aucune. */

const GENRES = ['partage', 'suppression', 'retard', 'jalon', 'permis', 'budget'];
const SURFACES = ['panneau', 'tableau'];

/** Une valeur par surface et par genre de notification. */
const partout = (f) => Object.fromEntries(SURFACES.map((s) =>
    [s, Object.fromEntries(GENRES.map((g) => [g, f(g)]))]));

/* Les noms d'un rendu. Balisés, chacun porte une balise inerte que seul un
   défaut d'échappement peut faire naître dans la page. Le nom du projet
   porte en outre &, ' et " : échappés une seule fois, ils s'affichent tels
   quels ; échappés deux fois, ils s'afficheraient en entités. */
function noms(jeton, balise) {
    const x = (mot, b) => (balise ? `<${b}>${mot}</${b}>` : mot);
    return {
        projet:      `Chantier ${x('Nord', 'i')} R&D l'"îlot" ${jeton}`,
        acteur:      `Alice ${x('D.', 'b')}`,
        suppression: `Coffrage ${x('voile', 'b')} ${jeton}-supprimee`,
        retard:      `Coulage ${x('dalle', 'b')} ${jeton}-retard`,
        jalon:       `Réception ${x('lot', 'b')} ${jeton}-jalon`,
        permis:      `PC ${x('bâtiment', 'b')} ${jeton}-permis`,
    };
}

/* Ce qui repère chaque notification dans une surface — un fragment hors de
   toute balise, qui survit donc au défaut comme au correctif —, et les noms
   qu'elle doit montrer. */
const reperes = (n, jeton) => ({
    partage:     { repere: 'vous a partagé le projet', noms: [n.acteur, n.projet] },
    suppression: { repere: `${jeton}-supprimee`,        noms: [n.acteur, n.suppression, n.projet] },
    retard:      { repere: `${jeton}-retard`,           noms: [n.retard, n.projet] },
    jalon:       { repere: `${jeton}-jalon`,            noms: [n.jalon, n.projet] },
    permis:      { repere: `${jeton}-permis`,           noms: [n.permis, n.projet] },
    budget:      { repere: 'Budget',                    noms: [n.projet] },
});

/* Rend le panneau et les alertes du tableau de bord à partir des données
   fabriquées, puis relève le DOM. Tout ce qui suit l'import — résolu sur le
   module déjà chargé par app.js (voir cleanup.js), donc sur la MÊME
   instance de store — est synchrone : les bouchons n'existent que le temps
   des deux rendus, et le relevé précède tout rafraîchissement que la page
   pourrait déclencher ensuite. */
async function rendreEtMesurer(page, jeton, n) {
    return page.evaluate(async ({ jeton, n, reperes }) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const app = window.app;

        const jour = (decalage) => {
            const d = new Date();
            d.setDate(d.getDate() + decalage);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const projet = { id: `e2e-notif-${jeton}`, name: n.projet, budget: 100 };
        const tache = (id, nom, debut, fin, extra = {}) => ({
            id: `${projet.id}-${id}`, projectId: projet.id, name: nom,
            startDate: jour(debut), endDate: jour(fin), progress: 0, status: 'todo', priority: 'medium',
            assignees: [], order: 0, isPhase: false, isMilestone: false, ...extra,
        });
        const taches = [
            tache('retard', n.retard, -10, -5),
            tache('jalon', n.jalon, 1, 1, { isMilestone: true }),
            /* Pièces complémentaires demandées, pas encore reçues : l'instruction
               est suspendue, ce qui donne une alerte de permis et une seule. */
            tache('permis', n.permis, -20, 30, { isPermit: true, permitType: 'PC',
                permitStatus: 'additional_docs', depositDate: jour(-20), additionalDocsRequestDate: jour(-10) }),
        ];
        /* Telles que les RPC les rédigent (migrations 008 et 009), sans id. */
        const notifs = [
            { type: 'project_shared', projectId: projet.id, actorName: n.acteur, readAt: null,
              message: `${n.acteur} vous a partagé le projet "${n.projet}" en écriture`, taskName: `${n.projet}|editor` },
            { type: 'task_deleted', projectId: projet.id, actorName: n.acteur, readAt: null,
              message: `${n.acteur} a supprimé "${n.suppression}"`, taskName: n.suppression },
        ];

        const lectures = ['getProjects', 'getTasks', 'getTaskCosts'];
        const originaux = Object.fromEntries(lectures.map((k) => [k, store[k]]));
        const propres = lectures.filter((k) => Object.prototype.hasOwnProperty.call(store, k));
        const notifsAvant = app._supabaseNotifs;
        const filtreAvant = app._dashboardFilterProjectId;
        try {
            store.getProjects = () => [projet];
            store.getTasks = () => taches.slice();
            store.getTaskCosts = () => ({ tasks: [], totalCost: 100, totalCostDone: 95 });
            app._supabaseNotifs = notifs;
            /* Les notifications Supabase n'ont pas de projectId une fois
               listées : le tableau de bord ne les montre que sans filtre. */
            app._dashboardFilterProjectId = 'all';
            document.getElementById('notifPanel')?.remove();
            app._toggleNotifPanel();
            app._renderDashboard();
        } finally {
            for (const k of lectures) {
                if (propres.includes(k)) store[k] = originaux[k];
                else delete store[k];
            }
            app._supabaseNotifs = notifsAvant;
            app._dashboardFilterProjectId = filtreAvant;
        }
        const retablis = lectures.every((k) => store[k] === originaux[k])
            && app._supabaseNotifs === notifsAvant && app._dashboardFilterProjectId === filtreAvant;

        const elements = {
            panneau: [...document.querySelectorAll('#notifPanel .notif-item')],
            tableau: [...document.querySelectorAll('#dashAlertList li.dashboard-alert-item')],
        };
        /* Les mots d'un nom qui se lisent avant comme après le correctif :
           hors balises, sans &, ' ni ". */
        const mots = (nom) => nom.replace(/<\/?[a-z]+>/g, '').split(/\s+/)
            .filter((m) => /^[\p{L}\p{N}.-]+$/u.test(m));
        const mesure = { nombre: {}, lisibles: {}, strong: {}, balises: {}, intacts: {} };
        const strongBudget = {};
        for (const [surface, liste] of Object.entries(elements)) {
            for (const k of Object.keys(mesure)) mesure[k][surface] = {};
            for (const [genre, { repere, noms }] of Object.entries(reperes)) {
                const trouves = liste.filter((e) => e.textContent.includes(jeton) && e.textContent.includes(repere));
                const e = trouves[0];
                const texte = e ? e.textContent : '';
                mesure.nombre[surface][genre] = trouves.length;
                mesure.lisibles[surface][genre] = !!e && noms.flatMap(mots).every((m) => texte.includes(m));
                mesure.strong[surface][genre] = e ? e.querySelectorAll('strong').length : null;
                mesure.balises[surface][genre] = e ? e.querySelectorAll('i, b').length : null;
                mesure.intacts[surface][genre] = !!e && noms.every((nom) => texte.includes(nom));
            }
            const budget = liste.find((e) => e.textContent.includes(jeton) && e.textContent.includes(reperes.budget.repere));
            strongBudget[surface] = budget?.querySelector('strong')?.textContent ?? null;
        }
        return { retablis, ...mesure, strongBudget };
    }, { jeton, n, reperes: reperes(n, jeton) });
}

test('le panneau des notifications et les alertes du tableau de bord n\'interprètent pas comme du balisage les noms venus d\'un autre compte', async ({ page }) => {
    const suffixe = Date.now();

    await page.goto('index.html');
    await waitForAppReady(page);

    try {
        /* ---- Premier rendu : des noms ordinaires ---- */
        const jetonOrdinaire = `${suffixe}-ordinaire`;
        const ordinaire = await rendreEtMesurer(page, jetonOrdinaire, noms(jetonOrdinaire, false));

        /* DISCRIMINANT 1 — LES BOUCHONS SONT RETIRÉS. Les trois lectures du
           store, la liste des notifications Supabase et le filtre du tableau
           de bord sont revenus à leurs valeurs d'origine. Ferme « le test a
           laissé des données fabriquées dans l'application » : une écriture
           ultérieure du compte, ou le nettoyage, les aurait lues. Passe
           avant comme après. */
        expect(ordinaire.retablis, 'bouchons retirés après le premier rendu').toBe(true);

        /* DISCRIMINANT 2 — LES DEUX SURFACES MONTRENT CHACUNE DES SIX
           NOTIFICATIONS, UNE FOIS. Ferme « les méthodes n'ont rien rendu » et
           « le test lit le mauvais élément » : sans ce point, une absence de
           balises plus bas pourrait venir d'un panneau vide, d'un tableau de
           bord filtré, ou d'une notification écartée comme déjà lue. Passe
           avant comme après. */
        expect(ordinaire.nombre, 'notifications rendues, noms ordinaires').toEqual(partout(() => 1));

        /* DISCRIMINANT 3 — LES GABARITS EUX-MÊMES NE CONTIENNENT NI <i> NI
           <b>. Ferme « les balises comptées plus bas viennent de
           l'application, pas des noms » : sans ce point, l'assertion
           centrale pourrait échouer sur un correctif juste. Passe avant
           comme après. */
        expect(ordinaire.balises, 'balises <i> et <b> des gabarits, sans nom balisé').toEqual(partout(() => 0));

        /* DISCRIMINANT 4 — LE <strong> VOULU EST LÀ : un dans l'alerte de
           jalon, un dans l'alerte de budget, aucun ailleurs. Ferme « le
           correctif échappe tout, y compris le balisage voulu » : échapper
           text à l'insertion afficherait « <strong> » en toutes lettres.
           Passe avant comme après. */
        const strongVoulus = partout((g) => (g === 'jalon' || g === 'budget' ? 1 : 0));
        expect(ordinaire.strong, '<strong> voulus, noms ordinaires').toEqual(strongVoulus);

        /* ---- Second rendu : des noms balisés ---- */
        const jeton = `${suffixe}-balise`;
        const n = noms(jeton, true);
        const balise = await rendreEtMesurer(page, jeton, n);

        /* DISCRIMINANTS 1 et 2, de nouveau, pour ce rendu. */
        expect(balise.retablis, 'bouchons retirés après le second rendu').toBe(true);
        expect(balise.nombre, 'notifications rendues, noms balisés').toEqual(partout(() => 1));

        /* DISCRIMINANT 5 — CHAQUE NOTIFICATION PORTE SES NOMS, au moins dans
           ce qui survit au défaut : les mots hors balises et ceux qu'elles
           entourent. Ferme « le nom n'est pas rendu du tout » : un sous-titre
           omis, ou un message vidé, ne contiendrait aucune balise sans pour
           autant afficher le nom. Passe avant comme après. */
        expect(balise.lisibles, 'mots des noms lisibles dans chaque notification').toEqual(partout(() => true));

        /* DISCRIMINANT 4, de nouveau, et le contenu du <strong> du budget :
           le nom du projet, chevrons et & compris. app.js l'échappait déjà
           là ; il doit le rester, une fois et une seule. Ferme « le
           correctif détruit ou ré-échappe le balisage voulu ». Passe avant
           comme après. */
        expect(balise.strong, '<strong> voulus, noms balisés').toEqual(strongVoulus);
        expect(balise.strongBudget, 'nom du projet dans le <strong> du budget').toEqual({ panneau: n.projet, tableau: n.projet });

        /* --- L'ASSERTION CENTRALE ---
           Aucune balise ne doit naître des noms : ni <i> du nom du projet,
           ni <b> de celui de l'acteur ou d'une tâche, dans aucune des deux
           surfaces. Faute d'échappement, le navigateur les crée. */
        expect(balise.balises,
            'aucune balise <i> ni <b> ne doit naître des noms, ni dans le panneau ni dans les alertes du tableau de bord')
            .toEqual(partout(() => 0));

        /* Et les noms se lisent intacts — chevrons, &, ' et " compris. */
        expect(balise.intacts, 'noms intacts dans chaque notification').toEqual(partout(() => true));
    } finally {
        /* Refermer le panneau ; retirer les alertes fabriquées du tableau de
           bord, ou le rendre de nouveau, bouchons retirés, s'il est la vue
           affichée — un rendu ne fait que lire le store. Une erreur ici ne
           doit pas remplacer le motif de l'échec : la page appartient au
           seul test, elle est jetée ensuite. */
        await page.evaluate(() => {
            document.getElementById('notifPanel')?.remove();
            if (window.app?._activeView === 'dashboard') window.app._renderDashboard();
            else document.getElementById('dashboardView')?.replaceChildren();
        }).catch(() => {});
    }
});
