import { test, expect } from '../fixtures.js';
import { createProject, deleteActiveProject } from '../helpers.js';

/* Régression : le lien d'invitation généré doit inclure le sous-chemin de
   déploiement (ex: /Gantt-Planner-V2/invite.html?token=...), pas seulement
   l'origine (voir le correctif documenté dans js/collaboration.js). Ce test
   sert l'app sous un sous-chemin (playwright.config.js) pour reproduire
   exactement la structure de GitHub Pages. */

test('le lien d\'invitation pointe vers le bon sous-chemin', async ({ page, baseURL }) => {
    const projectName = `E2E Invite ${Date.now()}`;
    const inviteeEmail = `e2e-invitee-${Date.now()}@example.com`;

    await page.goto('index.html');
    await createProject(page, projectName);

    await page.locator('#shareBtn').click();
    // collaborationUI.open() affiche la modale immédiatement mais ne lie le
    // clic du bouton "Inviter" qu'après deux appels réseau awaités (auth.getUser(),
    // getCurrentUserRole()) — attendre la liste des membres (peuplée après ce
    // point par _loadData()) garantit que le bouton est déjà interactif.
    await page.locator('.share-member-row').first().waitFor({ timeout: 10_000 });
    await page.locator('#shareEmailInput').fill(inviteeEmail);
    await page.locator('#shareInviteBtn').click();

    const linkInput = page.locator('.share-link-input');
    await expect(linkInput).toBeVisible({ timeout: 10_000 });
    const link = await linkInput.inputValue();

    const basePath = new URL(baseURL).pathname; // ex: /Gantt-Planner-V2/
    expect(link).toContain(`${basePath}invite.html?token=`);
    expect(new URL(link).origin).toBe(new URL(baseURL).origin);

    await page.locator('#shareModalClose').click();
    await deleteActiveProject(page);
});
