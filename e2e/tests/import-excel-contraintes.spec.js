import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { classeurXlsx, importerXlsx } from '../tableur.js';

/* Couvre TEST_PLAN.md § G (Import/Export), volet import Excel, sous
 * l'angle des CONTRAINTES DE DATE : l'import Excel lit une colonne « Type
 * de contrainte » et une colonne « Date de contrainte ».
 *
 * LE BESOIN. L'export CSV écrit désormais ces deux colonnes (avec les
 * libellés de la fiche), et un planning tenu sous Excel les porte souvent.
 * L'import les ignore : tout arrive en « Dès que possible ».
 *
 * LA RÈGLE. Les deux colonnes sont reconnues par leur en-tête ENTIER
 * (« Type de contrainte », « Date de contrainte », ou leur équivalent
 * anglais), jamais par un mot qu'il contient : une colonne de notes
 * « Contraintes » (accès, livraisons…) n'est pas un type. Le type se lit
 * par son libellé (fiche ou MS Project, français ou anglais, accents et
 * casse ignorés) ou par son code (MSO…). « Le plus tard possible »
 * n'existe pas ici : la tâche arrive en « Dès que possible », et un
 * avertissement la nomme. La date se lit comme les autres : cellule date
 * (en champs locaux, #112) ou texte AAAA-MM-JJ / JJ/MM/AAAA.
 *
 * LE CLASSEUR (un vrai .xlsx, classeurXlsx) — Nom, Début, Fin (cellules
 * date 08/06 et 10/06), Type de contrainte, Date de contrainte,
 * Contraintes (notes, « accès limité » partout) :
 *   T1  « Doit finir le »,        cellule date 12/06 ;
 *   T2  « Début au plus tôt le », cellule date 03/06 ;
 *   T3  « Le plus tard possible », sans date ;
 *   T4  « MSO »,                  texte '2026-06-15' ;
 *   T5  sans contrainte.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, T1 en « — » au lieu de « MFO 2026-06-12 ». Les discriminants
 * passent, faute de tout avertissement. */

test.use({ timezoneId: 'Europe/Paris' });

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

async function lire(page, noms) {
    return page.evaluate(async (noms) => {
        const { store } = await import(new URL('js/store.js', document.baseURI).href);
        const taches = store.getTasks();
        const une = (n) => { const t = taches.filter(x => x.name === n); return t.length === 1 ? t[0] : null; };
        return {
            projet: store.getActiveProject()?.name ?? null,
            dates: Object.fromEntries(noms.map(n => [n, une(n) ? `${une(n).startDate}→${une(n).endDate}` : 'introuvable'])),
            contraintes: Object.fromEntries(noms.map(n => [n, une(n)
                ? (une(n).constraintType ? `${une(n).constraintType} ${une(n).constraintDate}` : '—') : 'introuvable'])),
        };
    }, noms);
}

test('l\'import Excel lit le type et la date de contrainte, et ignore une colonne de notes « Contraintes »', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E ImportExcelContraintes ${suffixe}`;
    const [T1, T2, T3, T4, T5] = [1, 2, 3, 4, 5].map(i => `T${i} ${suffixe}`);

    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT D0 — LE FUSEAU DE LA PAGE EST PARIS. Ferme « le test
       tourne en UTC et ne verrait pas une date de contrainte reculer d'un
       jour ». */
    const fuseau = await page.evaluate(() => ({
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        decalage: new Date(2026, 5, 8).getTimezoneOffset(),
    }));
    expect(fuseau, 'fuseau de la page').toEqual({ zone: 'Europe/Paris', decalage: -120 });

    const d = (iso) => ({ date: iso });
    await importerXlsx(page, nomProjet, classeurXlsx([
        ['Nom', 'Début', 'Fin', 'Type de contrainte', 'Date de contrainte', 'Contraintes'],
        [T1, d('2026-06-08'), d('2026-06-10'), 'Doit finir le', d('2026-06-12'), 'accès limité'],
        [T2, d('2026-06-08'), d('2026-06-10'), 'Début au plus tôt le', d('2026-06-03'), 'accès limité'],
        [T3, d('2026-06-08'), d('2026-06-10'), 'Le plus tard possible', '', 'accès limité'],
        [T4, d('2026-06-08'), d('2026-06-10'), 'MSO', '2026-06-15', 'accès limité'],
        [T5, d('2026-06-08'), d('2026-06-10'), '', '', 'accès limité'],
    ]));
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);
    await expect(page.locator('#toastContainer .toast', { hasText: nomProjet }).first(),
        'l\'import doit aller à son terme').toBeVisible({ timeout: 30_000 });

    const lu = await lire(page, [T1, T2, T3, T4, T5]);

    /* DISCRIMINANT D1 — LES CINQ TÂCHES SONT LÀ, 08 → 10/06. Ferme « les
       en-têtes de contrainte ont volé la colonne Début ou Fin, ou l'import
       a échoué ». */
    expect(lu.dates, 'les tâches importées, à leurs dates').toEqual(
        Object.fromEntries([T1, T2, T3, T4, T5].map(n => [n, '2026-06-08→2026-06-10'])));

    /* DISCRIMINANT D2 — T5 EST EN « DÈS QUE POSSIBLE », et aucun
       avertissement ne nomme T1, T2, T4 ni T5. Ferme « la colonne de notes
       « Contraintes » est lue comme un type ». */
    expect(lu.contraintes[T5], 'T5 sans contrainte').toBe('—');
    for (const n of [T1, T2, T4, T5]) {
        await expect(page.locator('#toastContainer .toast-warning', { hasText: n }), `aucun avertissement pour ${n}`).toHaveCount(0);
    }

    // --- L'ASSERTION CENTRALE ---
    expect({ T1: lu.contraintes[T1], T2: lu.contraintes[T2], T3: lu.contraintes[T3], T4: lu.contraintes[T4] },
        'les contraintes importées').toEqual({
        T1: 'MFO 2026-06-12', T2: 'SNET 2026-06-03', T3: '—', T4: 'MSO 2026-06-15',
    });
    const avertissement = page.locator('#toastContainer .toast-warning', { hasText: T3 });
    await expect(avertissement, 'un avertissement nomme T3, « le plus tard possible »').toBeVisible({ timeout: 10_000 });

    await deleteActiveProject(page);
});
