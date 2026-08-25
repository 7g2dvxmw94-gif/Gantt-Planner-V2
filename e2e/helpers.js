/* Utilitaires partagés entre les specs E2E. */

import { trackActiveProject } from './cleanup.js';
import { DELAI_APP_PRETE } from './login.js';

/** Attend que App.init() soit passé (store.initFromSupabase() est awaité
 *  avant, donc les listeners comme celui du sélecteur de projet ne sont
 *  attachés qu'à ce moment — cliquer avant ne fait rien).
 *
 *  LE DÉLAI EST PASSÉ DE 15 À 30 SECONDES. Le 23 août 2026, le run
 *  32657688615 a vu douze tests buter ici en 15 s ; neuf s'en sont remis à
 *  la reprise, trois non. Un démarrage lent n'est pas un démarrage cassé, et
 *  attendre davantage ne retire rien à la capacité de détection : si
 *  l'application ne démarre vraiment plus, le test échoue toujours — quinze
 *  secondes plus tard. */
export async function waitForAppReady(page) {
    await page.locator('body[data-app-ready="true"]').waitFor({ timeout: DELAI_APP_PRETE });
}

/** Crée un projet via le bouton "Nouveau projet" (window.prompt natif).
 *
 *  store.addProject() attend désormais la fin de la synchronisation Supabase
 *  avant de renvoyer la main (mêmes anti-pattern et correctif que
 *  deleteActiveProject ci-dessous) ; attendre le toast de confirmation
 *  garantit que le projet existe bien côté serveur avant de continuer (ex.
 *  avant un rechargement de page qui re-fetch tout depuis Supabase).
 *
 *  Le projet est enregistré auprès du filet de nettoyage (cleanup.js) dès sa
 *  création : le test qui échoue ensuite, où que ce soit, ne laissera pas sa
 *  ligne en base pour autant. */
export async function createProject(page, name) {
    await waitForAppReady(page);
    page.once('dialog', (dialog) => dialog.accept(name));
    await page.locator('.project-selector').click();
    await page.locator('button.new-project').click();
    await expectProjectName(page, name);
    await page.locator('#toastContainer .toast', { hasText: `"${name}" créé` }).waitFor({ timeout: 10_000 });
    await trackActiveProject(page);
}

export async function expectProjectName(page, name) {
    await page.locator('#projectName').filter({ hasText: name }).waitFor({ timeout: 10_000 });
}

/** Supprime le projet actif via le menu déroulant (confirm() natif accepté).
 *
 *  store.deleteProject() synchronise la suppression vers Supabase de façon
 *  asynchrone (non bloquante pour l'UI) ; attendre le toast de confirmation
 *  garantit que cette écriture réseau est bien terminée avant de continuer
 *  (ex. avant de fermer la page en fin de test). Sans cette attente, le
 *  contexte du test pouvait se fermer avant que la requête de suppression
 *  ne parte, laissant le projet orphelin côté serveur — des dizaines de
 *  projets de test se sont ainsi accumulés en base avant correction. */
export async function deleteActiveProject(page) {
    await waitForAppReady(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.project-selector').click();
    await page.locator('button.project-dropdown-item.danger').click();
    await page.locator('#toastContainer .toast', { hasText: 'Projet supprimé' }).waitFor({ timeout: 10_000 });
}
