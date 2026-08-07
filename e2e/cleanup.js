/* Filet de nettoyage exécuté après CHAQUE test (voir fixtures.js).
 *
 *  Jusqu'ici, chaque spec supprimait son projet par la DERNIÈRE instruction
 *  de son corps de test. Un test qui échoue avant cette ligne n'y arrive
 *  jamais et laisse sa ligne en base — deux fois plutôt qu'une, `retries: 1`
 *  rejouant le test échoué. Des dizaines de projets orphelins se sont ainsi
 *  accumulés sur le compte de test partagé.
 *
 *  Ce filet ne REMPLACE pas le nettoyage des tests : celui-ci passe par
 *  l'interface (deleteActiveProject) et couvre à ce titre un vrai chemin
 *  utilisateur qu'il faut continuer d'exercer. Il le double, pour les cas
 *  où il n'a pas été atteint.
 *
 *  Deux choix expliquent la forme du code ci-dessous :
 *
 *  1. On supprime par ID, pas par motif de nom. Un `delete where name like
 *     'E2E %'` emporterait les projets d'un run concurrent sur le même
 *     compte (rien ne sérialise deux workflows CI). Chaque test ne nettoie
 *     donc que ce qu'il a lui-même créé.
 *
 *  2. On passe par store.deleteProject() plutôt que par la RPC directement.
 *     Le store pose un marqueur de suppression et attend les écritures de
 *     ligne projet encore en vol : une écriture tardive du test échoué (un
 *     renommage non attendu, par exemple) ne peut donc pas RECRÉER la ligne
 *     par UPSERT juste après notre DELETE. Nettoyer sans cette protection
 *     rouvrirait précisément la course qui a produit ces orphelins.
 *
 *  Les imports dynamiques ci-dessous sont résolus par URL : `js/store.js`
 *  relatif à la page désigne exactement le module déjà chargé par app.js,
 *  donc la MÊME instance de store — pas une copie fraîche qui ignorerait
 *  les écritures en vol et le marqueur de suppression.
 */

/** Ce que chaque test a créé, par page (une page = un test). */
const registry = new WeakMap();

function entryFor(page) {
    let entry = registry.get(page);
    if (!entry) {
        entry = { projectIds: new Set(), customization: undefined };
        registry.set(page, entry);
    }
    return entry;
}

/** Enregistre un projet à supprimer en fin de test. */
export function trackProject(page, projectId) {
    if (projectId) entryFor(page).projectIds.add(projectId);
}

/** Enregistre le projet actif. Appelé par createProject() ; à appeler
 *  explicitement pour un projet créé autrement (ex. copie issue d'un
 *  import). L'id est stable, un renommage ultérieur ne le périme pas. */
export async function trackActiveProject(page) {
    const id = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getActiveProject()?.id ?? null;
    });
    trackProject(page, id);
    return id;
}

/** Capture la personnalisation du compte pour la restaurer en fin de test.
 *  Contrairement au thème (localStorage, donc remis à zéro à chaque contexte
 *  navigateur), la personnalisation est écrite dans Supabase : elle survit
 *  au run. */
export async function snapshotCustomization(page) {
    entryFor(page).customization = await page.evaluate(async () => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        return store.getSettings().customization || {};
    });
}

/** Nettoyage de fin de test (appelé par la fixture `page`). */
export async function runCleanup(page) {
    const entry = registry.get(page);
    if (!entry) return;
    registry.delete(page);

    await restoreCustomization(page, entry.customization);
    await purgeProjects(page, [...entry.projectIds]);
}

/** Restauration best-effort : une personnalisation résiduelle est cosmétique
 *  (les deux specs de branding capturent l'état de départ au lieu de
 *  supposer une valeur), là où une ligne projet oubliée fausse les specs qui
 *  listent ou comptent les projets. On ne fait donc pas échouer un test
 *  là-dessus. */
async function restoreCustomization(page, snapshot) {
    if (!snapshot || page.isClosed()) return;
    try {
        await page.evaluate(async (snap) => {
            const { store } = await import(new URL('js/store.js', document.baseURI).href);
            const current = store.getSettings().customization || {};
            if (JSON.stringify(current) === JSON.stringify(snap)) return;
            await store.updateSettings({ customization: snap });
        }, snapshot);
    } catch {
        /* Page inutilisable : rien à sauver ici. */
    }
}

async function purgeProjects(page, ids) {
    if (!ids.length) return;

    let report;
    try {
        report = await onAppPage(page, ids);
    } catch (err) {
        throw new Error(
            `[cleanup] impossible de nettoyer les projets ${ids.join(', ')} : ${err.message}`
        );
    }

    if (report.error) {
        throw new Error(`[cleanup] lecture des projets impossible : ${report.error}`);
    }
    if (report.reclaimed.length) {
        /* Le test n'a pas fait son propre ménage : soit il a échoué avant,
           soit sa suppression n'a pas tenu côté serveur. Dans les deux cas
           on veut le voir dans les logs CI, pas seulement le réparer. */
        console.warn(
            `[cleanup] ${report.reclaimed.length} projet(s) non supprimé(s) par le test, ` +
            `rattrapé(s) par le filet : ${report.reclaimed.join(', ')}`
        );
    }
    if (report.failed.length) {
        throw new Error(
            '[cleanup] ces projets survivent à leur suppression et restent en base : ' +
            report.failed.join(', ')
        );
    }
}

/** Exécute la purge dans la page du test, avec repli si celle-ci n'est plus
 *  exploitable — un test peut échouer en ayant navigué ailleurs, ou avoir
 *  fait planter l'onglet. Le nettoyage doit survivre à l'état dans lequel le
 *  test l'a laissé, sinon il ne rattrape que les cas déjà inoffensifs. */
async function onAppPage(page, ids) {
    if (!page.isClosed()) {
        try {
            return await purgeIn(page, ids);
        } catch {
            try {
                await page.goto('index.html');
                return await purgeIn(page, ids);
            } catch {
                /* On tente une page neuve ci-dessous. */
            }
        }
    }

    const rescue = await page.context().newPage();
    try {
        await rescue.goto('index.html');
        return await purgeIn(rescue, ids);
    } finally {
        await rescue.close().catch(() => {});
    }
}

/** La relecture finale n'est pas un luxe : supabaseStore.deleteProject()
 *  journalise l'erreur de la RPC sans la propager, donc la promesse tient
 *  même quand la ligne est toujours là. Sans vérification, un nettoyage en
 *  échec serait exactement aussi silencieux que l'absence de nettoyage. */
async function purgeIn(target, ids) {
    return target.evaluate(async (projectIds) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const { supabase } = await import(new URL('js/supabase-client.js', document.baseURI).href);

        const { data, error } = await supabase.from('projects').select('id').in('id', projectIds);
        if (error) return { error: error.message, reclaimed: [], failed: [] };

        const present = (data || []).map(r => r.id);
        if (!present.length) return { reclaimed: [], failed: [] };

        for (const id of present) {
            await store.deleteProject(id).catch(() => {});
        }

        const { data: after } = await supabase.from('projects').select('id').in('id', present);
        const failed = (after || []).map(r => r.id);
        return { reclaimed: present.filter(id => !failed.includes(id)), failed };
    }, ids);
}
