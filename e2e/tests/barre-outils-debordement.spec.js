import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C1 (vues) : la barre d'outils ne déborde à aucune
 * largeur.
 *
 * LE DÉFAUT. `.toolbar` défile horizontalement, barre de défilement
 * masquée (css/layout.css). Quand ses contrôles ne tiennent pas, les
 * derniers — « Nouvelle tâche » en tête — sont coupés à droite, sans
 * aucun signe visible qu'il en reste. Le WBS ajoutera un onglet : la barre
 * doit d'abord tenir à toute largeur.
 *
 * LE PIRE CAS MESURÉ : le bouton de synchronisation affiché, le bouton des
 * conflits affiché (« ⚠ 12 conflits »), le libellé de zoom le plus long
 * (« Trimestre »), les transitions coupées (on ne lit pas un état
 * intermédiaire), la police Inter chargée. Balayage de 769 à 2 600 px, au
 * pas de 1 : la largeur qui déborde est `scrollWidth > clientWidth`.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale : la liste des plages de largeurs en débordement n'est pas
 * vide. Les discriminants passent. */

test.setTimeout(180_000);

test('la barre d\'outils ne déborde à aucune largeur de 769 à 2 600 px', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('index.html');
    await waitForAppReady(page);
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });

    /* Le pire cas : synchronisation et conflits affichés, libellé de zoom
       le plus long. */
    await page.evaluate(() => {
        const sync = document.getElementById('syncStatusBtn');
        if (sync) sync.style.display = '';
        const conflits = document.getElementById('conflitsBtn');
        if (conflits) {
            conflits.hidden = false;
            const texte = conflits.querySelector('.conflits-btn-texte');
            if (texte) texte.textContent = '12 conflits';
        }
        const zoom = document.querySelector('.zoom-label');
        if (zoom) zoom.textContent = 'Trimestre';
    });

    /* DISCRIMINANT 1 — INTER EST CHARGÉE (400 à 700). Ferme « la mesure
       dépend d'une police de repli ». */
    const polices = await page.evaluate(async () => {
        await document.fonts.ready;
        return [400, 500, 600, 700].map(p => document.fonts.check(`${p} 14px Inter`));
    });
    expect(polices, 'Inter chargée en 400, 500, 600, 700').toEqual([true, true, true, true]);

    /* DISCRIMINANT 2 — LE PIRE CAS EST EN PLACE. */
    await expect(page.locator('#syncStatusBtn'), 'bouton de synchronisation affiché').toBeVisible();
    await expect(page.locator('#conflitsBtn'), 'bouton des conflits affiché').toBeVisible();
    await expect(page.locator('.zoom-label'), 'libellé de zoom le plus long').toHaveText('Trimestre');

    /* DISCRIMINANT 3 — C'EST LA BARRE DE L'APPLICATION : autant d'onglets
       que d'entrées de la navigation mobile, et « Nouvelle tâche ». Écrit
       pour rester vrai quand le WBS ajoutera un onglet. */
    const onglets = await page.locator('.toolbar button.tab[role="tab"]').count();
    expect(onglets, 'onglets de la barre').toBe(await page.locator('.mobile-nav-item').count());
    await expect(page.locator('#addTaskBtn'), '« Nouvelle tâche »').toBeVisible();

    const deborde = [];
    for (let l = 769; l <= 2600; l++) {
        await page.setViewportSize({ width: l, height: 800 });
        const d = await page.locator('.toolbar').evaluate(el => el.scrollWidth - el.clientWidth);
        if (d > 0) deborde.push([l, d]);
    }
    const plages = [];
    for (const [l] of deborde) {
        const der = plages[plages.length - 1];
        if (der && der[1] === l - 1) der[1] = l; else plages.push([l, l]);
    }
    const texte = plages.map(([a, b]) => a === b ? `${a}` : `${a}-${b}`).join(', ');
    const pire = deborde.reduce((m, [, d]) => Math.max(m, d), 0);

    // --- L'ASSERTION CENTRALE ---
    expect(texte, `largeurs en débordement (${deborde.length} largeurs, au plus ${pire} px)`).toBe('');
});
