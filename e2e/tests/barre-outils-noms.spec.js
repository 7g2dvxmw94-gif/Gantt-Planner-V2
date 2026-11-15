import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § C (vues) et l'accessibilité de la barre d'outils :
 * un contrôle dont le libellé est masqué garde un nom et une infobulle.
 *
 * LE DÉFAUT. Sous 1 600 px, la barre masque les libellés des boutons
 * secondaires ; sous 1 400 px, ceux des onglets (css/responsive.css). La
 * règle de la barre est qu'un libellé masqué est relayé par `aria-label`
 * (le nom pour un lecteur d'écran) et `title` (l'infobulle à la souris).
 * Annuler, Rétablir, Chemin critique, DCMA, Référence et Importer la
 * tiennent. Les cinq onglets n'ont ni l'un ni l'autre : à 1 280 px, ce
 * sont des boutons sans nom, réduits à une icône sans infobulle. Exporter
 * a un nom mais pas d'infobulle. Forme : « un invariant énoncé quelque
 * part et démenti ailleurs ». Le WBS ajoutera un onglet et masquera
 * davantage de libellés (barre d'outils, prérequis P0g) : il faut d'abord
 * que tout libellé masqué ait son relais.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, la liste des fautifs : tabTimeline, tabBoard, tabResources,
 * tabDashboard, tabCosts (nom vide, pas d'infobulle) et exportBtn (pas
 * d'infobulle). Les discriminants passent. */

/** Les boutons visibles de la barre dont le libellé est masqué, avec leur
 *  nom (aria-label, sinon le texte visible) et leur infobulle. */
async function relever(page) {
    return page.evaluate(() => {
        const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
        const boutons = [...document.querySelectorAll('.toolbar button')].filter(visible);
        return boutons.map(b => {
            const libelles = [...b.querySelectorAll('span')].filter(s => s.textContent.trim() && s.getAttribute('aria-hidden') !== 'true');
            if (!libelles.length) return null;
            const masque = libelles.every(s => !visible(s));
            if (!masque) return null;
            const nom = (b.getAttribute('aria-label') || '').trim() || (b.innerText || '').trim();
            return { id: b.id || b.className, nom, titre: (b.getAttribute('title') || '').trim() };
        }).filter(Boolean);
    });
}

test('à 1 280 px, chaque contrôle de la barre au libellé masqué a un nom et une infobulle', async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 720 });
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT 2 — À 1 500 PX, le nom accessible d'un onglet se lit par
       son libellé visible : le calcul du nom fonctionne dans ce montage. */
    await expect(page.getByRole('tab', { name: 'Timeline' }), 'l\'onglet Timeline se trouve par son nom').toHaveCount(1);

    await page.setViewportSize({ width: 1280, height: 720 });
    const releve = await relever(page);

    /* DISCRIMINANT 1 — LES LIBELLÉS SONT BIEN MASQUÉS à 1 280 px : les cinq
       onglets et les boutons secondaires figurent au relevé. Ferme « les
       libellés sont visibles, le nom viendrait du texte affiché et le test
       ne mesurerait rien ». */
    const ids = releve.map(r => r.id);
    for (const id of ['tabTimeline', 'tabBoard', 'tabResources', 'tabDashboard', 'tabCosts', 'criticalPathBtn', 'dcmaBtn', 'exportBtn']) {
        expect(ids, `le libellé de ${id} est masqué à 1 280 px`).toContain(id);
    }

    // --- L'ASSERTION CENTRALE ---
    const fautifs = releve.filter(r => !r.nom || !r.titre).map(r => `${r.id}${!r.nom ? ' (sans nom)' : ''}${!r.titre ? ' (sans infobulle)' : ''}`);
    expect(fautifs, 'contrôles au libellé masqué sans nom ou sans infobulle').toEqual([]);
});
