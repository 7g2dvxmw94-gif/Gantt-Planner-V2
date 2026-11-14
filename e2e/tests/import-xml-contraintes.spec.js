import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';

/* Couvre TEST_PLAN.md § G4 (import MS Project), sous l'angle des
 * CONTRAINTES DE DATE : l'import XML lit la contrainte de chaque tâche.
 *
 * LE BESOIN. Un planning MS Project porte ses contraintes dans
 * <ConstraintType> et <ConstraintDate>. L'import les ignore : un fichier
 * plein de « Doit finir le » arrive en « Dès que possible », et le moteur
 * replace les tâches autrement.
 *
 * LES CODES (schéma MSPDI) : 0 dès que possible, 1 le plus tard possible,
 * 2 doit commencer le, 3 doit finir le, 4 début au plus tôt le, 5 début
 * au plus tard le, 6 fin au plus tôt le, 7 fin au plus tard le.
 *
 * LES CAS :
 *   - un par type, 2 à 7 ;
 *   - « le plus tard possible » (1), que l'application n'a pas (décision de
 *     l'utilisateur) : importée en « Dès que possible », et un
 *     avertissement la nomme ;
 *   - une récapitulative contrainte : une phase n'a pas de contrainte ;
 *   - une « début au plus tôt le » 12/06 À 17:00 : la tâche ne peut
 *     commencer avant la fin de ce jour, donc pas avant le jour ouvré
 *     suivant, le lundi 15 ;
 *   - une « doit commencer le » 15/06 dont les dates (17 → 19) ne la
 *     tiennent pas : importée telle quelle, elle est signalée « non
 *     tenue » par la liste des conflits.
 *
 * ROUGE ATTENDU POUR LE COMMIT DE TEST : 1 failed, sur l'assertion
 * centrale, la première tâche en « — » au lieu de « MSO 2026-06-15 ».
 * Les discriminants passent. JUIN 2026 COMMENCE UN LUNDI. */

/** [nom, début, fin, code, date de contrainte, extra] ; UID = rang + 1. */
const TACHES = [
    ['MSO',       '2026-06-15', '2026-06-17', '2', '2026-06-15T08:00:00', { pred: 7 }],
    ['MFO',       '2026-06-10', '2026-06-12', '3', '2026-06-12T17:00:00'],
    ['SNET',      '2026-06-08', '2026-06-10', '4', '2026-06-08T08:00:00'],
    ['SNLT',      '2026-06-08', '2026-06-10', '5', '2026-06-08T08:00:00'],
    ['FNET',      '2026-06-08', '2026-06-10', '6', '2026-06-10T17:00:00'],
    ['FNLT',      '2026-06-08', '2026-06-10', '7', '2026-06-10T17:00:00'],
    ['ALAP',      '2026-06-08', '2026-06-10', '1', '2026-06-08T08:00:00'],
    ['Phase',     '2026-06-08', '2026-06-10', '4', '2026-06-08T08:00:00', { sommaire: true }],
    ['SNET17h',   '2026-06-15', '2026-06-17', '4', '2026-06-12T17:00:00'],
    ['MSOdecale', '2026-06-17', '2026-06-19', '2', '2026-06-15T08:00:00'],
];

function xml(nomProjet, suffixe) {
    const lignes = TACHES.map(([nom, debut, fin, code, date, extra = {}], i) => {
        const uid = i + 1;
        const lien = extra.pred
            ? `<PredecessorLink><PredecessorUID>${extra.pred}</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`
            : '';
        return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${nom} ${suffixe}</Name>` +
            `<OutlineLevel>1</OutlineLevel>${extra.sommaire ? '<Summary>1</Summary>' : ''}` +
            `<Start>${debut}T08:00:00</Start><Finish>${fin}T17:00:00</Finish>` +
            `<Duration>PT24H0M0S</Duration><PercentComplete>0</PercentComplete>` +
            `<ConstraintType>${code}</ConstraintType><ConstraintDate>${date}</ConstraintDate>${lien}</Task>`;
    }).join('\n      ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
   <Name>${nomProjet}</Name>
   <Tasks>
      <Task><UID>0</UID><ID>0</ID><Name>${nomProjet}</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>
      ${lignes}
   </Tasks>
</Project>`;
}

async function present(locator, quoi) {
    await expect(locator, `introuvable : ${quoi}`).toHaveCount(1);
    return locator;
}

/** Dates, contrainte et liens des tâches nommées, lus dans le store VIVANT. */
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
            liens: Object.fromEntries(noms.map(n => [n, une(n)
                ? (une(n).dependencies || []).map(d => `${(taches.find(x => x.id === d.taskId) || {}).name}|${d.type}`) : []])),
        };
    }, noms);
}

test('l\'import MS Project lit les contraintes de date, et avertit pour « le plus tard possible »', async ({ page }) => {
    const suffixe = Date.now();
    const nomProjet = `E2E ImportXmlContraintes ${suffixe}`;
    const noms = TACHES.map(([n]) => `${n} ${suffixe}`);
    const nom = (cle) => `${cle} ${suffixe}`;

    await page.goto('index.html');
    await waitForAppReady(page);
    const bouton = await present(page.locator('#importBtn'), 'bouton « Importer »');
    const selecteur = page.waitForEvent('filechooser');
    await bouton.click();
    await (await selecteur).setFiles({
        name: 'import-xml-contraintes.xml', mimeType: 'application/xml',
        buffer: Buffer.from(xml(nomProjet, suffixe)),
    });
    await expect.poll(async () => (await lire(page, [])).projet,
        { message: 'le projet importé doit devenir le projet actif', timeout: 15_000 }).toBe(nomProjet);
    await trackActiveProject(page);

    const lu = await lire(page, noms);

    /* DISCRIMINANT D1 — LES DIX TÂCHES SONT LÀ, À LEURS DATES. Ferme
       « l'import a échoué, ou a replacé les tâches ». */
    expect(lu.dates, 'les tâches importées, à leurs dates').toEqual(
        Object.fromEntries(TACHES.map(([n, debut, fin]) => [`${n} ${suffixe}`, `${debut}→${fin}`])));

    /* DISCRIMINANT D2 — LE LIEN PORTÉ PAR UNE TÂCHE CONTRAINTE EST LÀ.
       Ferme « la seconde passe (liens) est cassée par la lecture des
       contraintes ». */
    expect(lu.liens[nom('MSO')], 'le lien de la MSO').toEqual([`${nom('ALAP')}|FS`]);

    // --- L'ASSERTION CENTRALE ---
    expect(lu.contraintes, 'les contraintes importées').toEqual({
        [nom('MSO')]: 'MSO 2026-06-15',
        [nom('MFO')]: 'MFO 2026-06-12',
        [nom('SNET')]: 'SNET 2026-06-08',
        [nom('SNLT')]: 'SNLT 2026-06-08',
        [nom('FNET')]: 'FNET 2026-06-10',
        [nom('FNLT')]: 'FNLT 2026-06-10',
        [nom('ALAP')]: '—',
        [nom('Phase')]: '—',
        [nom('SNET17h')]: 'SNET 2026-06-15',
        [nom('MSOdecale')]: 'MSO 2026-06-15',
    });
    const avertissement = page.locator('#toastContainer .toast-warning', { hasText: nom('ALAP') });
    await expect(avertissement, 'un avertissement nomme la tâche « le plus tard possible »').toBeVisible({ timeout: 10_000 });
    await expect(avertissement).toContainText('Dès que possible');

    /* La MSO décalée est la seule « non tenue » : le bouton des conflits
       compte 1, et la liste la nomme. */
    const conflitsBtn = page.locator('#conflitsBtn');
    await expect(conflitsBtn, 'la MSO décalée est un conflit').toHaveAttribute('aria-label', '1 conflit');
    await conflitsBtn.click();
    const ligne = page.locator('#conflitsModal .conflit-ligne');
    await expect(ligne).toHaveCount(1);
    await expect(ligne).toContainText(nom('MSOdecale'));
    await expect(ligne).toContainText('non tenue');
    await page.keyboard.press('Escape');
    await expect(page.locator('#conflitsModal')).toHaveCount(0);

    await deleteActiveProject(page);
});
