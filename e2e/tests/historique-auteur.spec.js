import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject, waitForAppReady } from '../helpers.js';

/* Le journal du projet (project_history) doit dire QUI a fait quoi. Audit de
 * sécurité, point S2.
 *
 * LE DÉFAUT, mesuré dans la base le 18/11/2026 :
 *   - la RPC log_project_history(p_project_id, p_actor_id, p_actor_name,
 *     …) en service écrit l'auteur QU'ON LUI TRANSMET : elle vérifie
 *     seulement que p_actor_id est membre du projet, jamais qu'il est
 *     l'appelant, et recopie p_actor_name tel quel ;
 *   - la politique « history: insert if editor » laisse en outre tout
 *     éditeur insérer une ligne DIRECTEMENT, auteur et nom au choix.
 * Un membre peut donc inscrire « Marie a supprimé la tâche X » au nom d'un
 * autre : le journal n'a plus de valeur de preuve.
 *
 * LA RÈGLE (migration 032) : quelle que soit la voie, l'auteur d'une
 * entrée est l'utilisateur CONNECTÉ (auth.uid()), et son nom celui de son
 * profil — full_name, sinon l'email —, la règle même de
 * supabaseStore.logHistory().
 *
 * LE TEST écrit deux entrées dans un projet qu'il crée, l'une par la RPC,
 * l'autre par INSERT direct, en annonçant un nom d'auteur inventé. Aucune
 * charge active : un nom ordinaire suffit à montrer qu'il n'est pas
 * remplacé.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale « nom d'auteur des entrées écrites » : « nom inventé », deux
 * fois, au lieu de « nom du profil ». Les discriminants — les deux écritures
 * acceptées, une entrée chacune, l'identifiant d'auteur juste — passent. */

test('le journal du projet inscrit l\'utilisateur connecté, pas l\'auteur annoncé par l\'appelant', async ({ page }) => {
    const s = Date.now();
    const nomProjet = `E2E HistoriqueAuteur ${s}`;
    const invente = `Auteur Invente ${s}`;

    await page.goto('index.html');
    await waitForAppReady(page);
    await createProject(page, nomProjet);

    const r = await page.evaluate(async ({ s, invente }) => {
        const base = document.baseURI;
        const { supabase } = await import(new URL('js/supabase-client.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const projet = store.getActiveProject().id;
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profil } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
        const reel = (profil?.full_name || '').trim() || profil?.email || user.email;

        const parRpc = await supabase.rpc('log_project_history', {
            p_project_id: projet, p_actor_id: user.id, p_actor_name: invente,
            p_action: 'a modifié', p_entity_type: 'task', p_entity_name: `rpc ${s}`,
        });
        const direct = await supabase.from('project_history').insert({
            project_id: projet, actor_id: user.id, actor_name: invente,
            action: 'a modifié', entity_type: 'task', entity_name: `directe ${s}`,
        });
        const { data: lignes, error: lecture } = await supabase.from('project_history')
            .select('actor_id, actor_name, entity_name').eq('project_id', projet)
            .in('entity_name', [`rpc ${s}`, `directe ${s}`]).order('entity_name');
        /* Ni le nom ni l'email du compte ne sortent de la page : le dépôt
           est public, ses journaux d'intégration aussi. On rend des
           étiquettes. */
        const etiquette = (nom) => nom === reel ? 'nom du profil' : nom === invente ? 'nom inventé' : 'autre nom';
        return {
            reelLisible: !!reel && reel !== invente, moi: user.id,
            erreurs: [parRpc.error?.message || null, direct.error?.message || null, lecture?.message || null],
            lignes: (lignes || []).map(l => ({ ...l, actor_name: etiquette(l.actor_name) })),
        };
    }, { s, invente });

    /* DISCRIMINANT 1 — LES DEUX ÉCRITURES SONT ACCEPTÉES, la lecture aussi.
       Ferme « le correctif interdit d'écrire » : refuser la voie directe
       règlerait le nom en cassant le journal. Passe avant comme après. */
    expect(r.erreurs, 'RPC, insertion directe et lecture sans erreur').toEqual([null, null, null]);

    /* DISCRIMINANT 2 — UNE ENTRÉE PAR VOIE, avec l'identifiant de
       l'utilisateur connecté. Ferme « l'entrée n'a pas été écrite, donc
       aucun nom à comparer ». Passe avant comme après. */
    expect(r.lignes.map(l => `${l.entity_name} : ${l.actor_id === r.moi ? 'moi' : 'autre'}`),
        'une entrée par voie, au nom de l\'utilisateur connecté').toEqual([`directe ${s} : moi`, `rpc ${s} : moi`]);

    /* DISCRIMINANT 3 — LE NOM RÉEL N'EST PAS LE NOM INVENTÉ. Ferme « le
       test passerait parce que les deux noms se confondent ». */
    expect(r.reelLisible, 'le nom du profil est lisible et distinct du nom inventé').toBe(true);

    // --- L'ASSERTION CENTRALE ---
    expect(r.lignes.map(l => l.actor_name), 'nom d\'auteur des entrées écrites').toEqual(['nom du profil', 'nom du profil']);

    await deleteActiveProject(page);
});
