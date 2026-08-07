/* `test` étendu par un nettoyage de fin de test.
 *
 *  Les specs importent test/expect d'ici plutôt que de @playwright/test :
 *  le filet s'applique alors à tous les tests sans qu'aucun n'ait à y
 *  penser, y compris ceux qu'on ajoutera ensuite. Un afterEach copié dans
 *  chaque fichier aurait le défaut inverse — on l'oublie exactement là où
 *  il manque déjà.
 *
 *  Le nettoyage est branché sur la fixture `page` : sa phase de démontage
 *  s'exécute quoi qu'il arrive au test, et avant la fermeture du contexte,
 *  donc pendant que la page peut encore parler à Supabase. */

import { test as base, expect } from '@playwright/test';
import { runCleanup } from './cleanup.js';

export const test = base.extend({
    page: async ({ page }, use) => {
        await use(page);
        await runCleanup(page);
    },
});

export { expect };
