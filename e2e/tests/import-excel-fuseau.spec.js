import { test, expect } from '../fixtures.js';
import { deleteActiveProject, waitForAppReady } from '../helpers.js';
import { trackActiveProject } from '../cleanup.js';
import { classeurXlsx, importerXlsx } from '../tableur.js';

/* Couvre TEST_PLAN.md § G (Import/Export), volet import Excel, à l'EST de
 * Greenwich — là où vit l'utilisateur.
 *
 * LE DÉFAUT : importFromExcel() (js/store.js) convertit une cellule date
 * par
 *
 *     if (v instanceof Date) return v.toISOString().substring(0, 10);
 *
 * Or dans un .xlsx une date n'est pas un instant : c'est un NUMÉRO DE
 * SÉRIE (jours depuis le 30/12/1899), qu'un format de cellule désigne comme
 * une date. SheetJS, tel que l'appelle _importExcelFile (app.js) —
 * XLSX.read avec `cellDates: true`, puis sheet_to_json —, en rend un objet
 * Date à MINUIT LOCAL. (Mesuré : XLSX.read seul range dans la cellule une
 * Date à minuit UTC ; c'est sheet_to_json qui la ramène à minuit local.)
 * toISOString() l'écrit en UTC : à l'est de Greenwich, minuit local est
 * encore la veille en UTC. Chaque cellule date recule d'un jour.
 *
 * L'INVARIANT EST ÉCRIT dans utils.js, dans le commentaire qui précède
 * parseISO() : « Tout ce module construit et lit les dates en LOCAL,
 * exclusivement ». formatDateISO() existe pour cela ; fmtDate ne l'appelle
 * pas.
 *
 * MESURÉ HORS NAVIGATEUR, SheetJS 0.20.3 (la version que charge
 * l'application, empreinte comparée à celle du CDN), le classeur de
 * classeurXlsx() relu comme _importExcelFile, puis le TEXTE RÉEL de
 * fmtDate extrait de store.js :
 *
 *                       cellules date 08/06 → 10/06   cellules texte
 *     Europe/Paris      2026-06-07 → 2026-06-09       2026-06-08 → 2026-06-10
 *     UTC               2026-06-08 → 2026-06-10       idem
 *     America/New_York  2026-06-08 → 2026-06-10       idem
 *
 * sheet_to_json rend bien « Mon Jun 08 2026 00:00:00 GMT+0200 » sous Paris :
 * la lecture du fichier est juste, c'est la conversion qui recule. En hiver
 * aussi (GMT+0100) : une cellule au 05/01/2026 est relue le 04/01.
 *
 * MESURÉ DANS L'APPLICATION ENTIÈRE (harnais à faux Supabase) : ce
 * fichier tel quel, sous Paris, lit 2026-06-07 → 2026-06-09 dans la fiche.
 * Une mesure à part, même harnais, montre que c'est aussi ce qui part en
 * base (start_date, end_date), le même recul sous Asia/Tokyo, aucun sous
 * Pacific/Honolulu.
 *
 * POURQUOI LA SUITE NE L'AVAIT JAMAIS VU : avant ce test, aucun test
 * d'import ne fixait de fuseau. Quatre specs en fixaient un —
 * duree-changement-heure sous Europe/Paris ; gantt-fuseau-ouest,
 * phase-fuseau-ouest et plage-timeline-fuseau-ouest sous
 * America/New_York —, mais elles portent sur la durée au changement
 * d'heure, la frise et les phases. Les autres tests d'import tournent dans
 * le fuseau du runner — UTC selon les tests de fuseau ouest, non remesuré
 * ici —, où minuit local EST minuit UTC. Et le seul test d'import Excel
 * jusque-là, import-excel-persistance.spec.js, importe des dates sans les
 * relire.
 *
 * TROIS FUSEAUX, UN SEUL ROUGE ATTENDU. Paris est le cas du défaut. UTC et
 * New York passent avant comme après : ils sont là pour que le correctif
 * ne répare pas l'est en cassant le reste (un « +1 jour » passerait à
 * Paris et casserait les deux autres).
 *
 * LIMITE : trois fuseaux ne bornent pas tout. Un « +12 h puis
 * toISOString() » passe aussi les trois, et serait faux à UTC+13 et
 * UTC+14 (Apia, Kiritimati) comme à UTC−12. Ce n'est pas ce test qui
 * l'exclut, c'est le balayage hors navigateur, de UTC−12 à UTC+14.
 */

const FUSEAUX = [
    { fuseau: 'Europe/Paris',     decalage: -120 },   // UTC+2 en juin : le défaut
    { fuseau: 'UTC',              decalage: 0 },      // celui des runners
    { fuseau: 'America/New_York', decalage: 240 },    // UTC-4 en juin : l'ouest
];

/* Lundi 08 → mercredi 10 juin 2026 : trois jours ouvrés, aucun férié. Le
   défaut donne dimanche 07 → mardi 09. */
const DEBUT = '2026-06-08';
const FIN = '2026-06-10';

/** La cellule de gauche d'une ligne (nom et méta) : l'ouvrir ne dépend ni
 *  du zoom ni de la position de la barre dans la frise. */
function cellule(page, nom) {
    return page.locator('.gantt-row[data-task-id] .task-info').filter({ hasText: nom });
}

/** Ouvre la fiche d'une tâche, vérifie que c'est bien la sienne, relit ses
 *  dates, la referme. */
async function datesDeLaFiche(page, nom) {
    await expect(cellule(page, nom), `ligne « ${nom} » présente`).toBeVisible({ timeout: 10_000 });
    await cellule(page, nom).dblclick();
    await expect(page.locator('#taskModalOverlay')).toBeVisible();
    /* La fiche est celle de cette tâche, pas d'une autre restée ouverte : on
       ne relit pas les dates d'une voisine. */
    await expect(page.locator('#taskName')).toHaveValue(nom);
    const dates = {
        debut: await page.locator('#taskStart').inputValue(),
        fin: await page.locator('#taskEnd').inputValue(),
    };
    await page.locator('#taskModalOverlay').locator('button.btn-secondary', { hasText: 'Annuler' }).click();
    await expect(page.locator('#taskModalOverlay')).toBeHidden({ timeout: 15_000 });
    return dates;
}

for (const { fuseau, decalage } of FUSEAUX) {
    test.describe(fuseau, () => {
        test.use({ timezoneId: fuseau });

        test(`import Excel : une cellule date garde son jour (${fuseau})`, async ({ page }) => {
            const suffixe = Date.now();
            /* Le nom du fichier devient le nom du projet : il porte
               l'horodatage, la CI partageant un seul compte. */
            const nomProjet = `E2E Excel Fuseau ${suffixe}`;
            const tacheDate = `Cellules date ${suffixe}`;
            const tacheTexte = `Cellules texte ${suffixe}`;

            await page.goto('index.html');
            await waitForAppReady(page);

            /* PREMIER DISCRIMINANT — LE FUSEAU A PRIS DANS LA PAGE.
               Ferme : « timezoneId n'a pas été appliqué, le test tourne dans
               le fuseau de la machine (UTC en CI) et ne peut rien voir ». Le
               décalage est lu AU 08/06/2026, pour l'heure d'été. */
            const lu = await page.evaluate(() => ({
                fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
                decalage: new Date(2026, 5, 8).getTimezoneOffset(),
            }));
            expect(lu, 'fuseau de la page').toEqual({ fuseau, decalage });

            /* Deux tâches aux MÊMES jours. La première les porte comme Excel
               les stocke (numéro de série + format date) ; la seconde en
               cellules TEXTE, que SheetJS laisse en chaînes et que fmtDate lit
               telles quelles — aucune conversion de fuseau sur ce chemin. */
            await importerXlsx(page, nomProjet, classeurXlsx([
                ['Nom', 'Debut', 'Fin'],
                [tacheDate, { date: DEBUT }, { date: FIN }],
                [tacheTexte, DEBUT, FIN],
            ]));

            /* SECOND DISCRIMINANT — L'IMPORT A EU LIEU, ET LE NOM EST LU.
               Ferme : « SheetJS ne s'est pas chargé, le fichier a été refusé,
               ou la colonne du nom n'a pas été reconnue ». Le chargement de
               SheetJS depuis son CDN précède l'import : délai généreux. */
            await expect(page.locator('#toastContainer .toast', { hasText: nomProjet }),
                'toast de l\'import Excel').toBeVisible({ timeout: 20_000 });
            await expect(page.locator('#projectName')).toHaveText(nomProjet);
            await trackActiveProject(page);
            await expect(cellule(page, tacheDate), 'tâche aux cellules date importée sous son nom')
                .toBeVisible({ timeout: 10_000 });

            /* TROISIÈME DISCRIMINANT — LES MÊMES JOURS, EN TEXTE, ARRIVENT
               INTACTS. Ferme : « le décalage vient d'ailleurs que de la
               conversion des cellules date » — de la fiche qui afficherait
               un jour de moins, d'un recalage après import, ou des colonnes
               Début/Fin non reconnues (les dates seraient vides). Il passe
               avant comme après le correctif, dans les trois fuseaux. */
            expect(await datesDeLaFiche(page, tacheTexte), 'cellules texte relues dans la fiche')
                .toEqual({ debut: DEBUT, fin: FIN });

            /* --- L'ASSERTION CENTRALE ---
               Les cellules date, relues dans la fiche, portent les jours du
               fichier. Le défaut les fait reculer d'un jour à Paris :
               2026-06-07 → 2026-06-09. */
            expect(await datesDeLaFiche(page, tacheDate), 'cellules date relues dans la fiche')
                .toEqual({ debut: DEBUT, fin: FIN });

            await deleteActiveProject(page);
        });
    });
}
