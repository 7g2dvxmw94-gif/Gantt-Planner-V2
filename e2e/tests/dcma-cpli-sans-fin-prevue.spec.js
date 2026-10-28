import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle du CPLI
 * (point 13) du rapport DCMA 14 points.
 *
 * LE DÉFAUT : sans fin prévue, le CPLI dit que la fin prévue est passée.
 *
 *     const cpl = finPrevue ? workingDaysBetween(dateEtat, finPrevue, cal) : 0;
 *     …
 *     } else if (cpl <= 0) { … raison: 'fin-passee' }
 *
 * Un projet neuf sans tâche, ou dont aucune tâche n'est datée, n'a pas de
 * fin prévue : finPrevue vaut null, cpl vaut 0, et la remarque affichée est
 * « la fin prévue précède la date d'état ». C'est faux — il n'y a rien à
 * précéder. Pour un projet vide, les points 1 à 4 et 6 à 10 disent
 * « aucune tâche concernée ». L'état, « non mesurable », est juste ; seule
 * la raison ment.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * TROIS PLANNINGS, une même échéance au 30 juin 2026 :
 *   - une tâche finie le 5 juin, date d'état le 10 : la fin prévue précède
 *     vraiment la date d'état — DISCRIMINANT ;
 *   - aucune tâche ;
 *   - une tâche sans dates, comme l'import Excel en laisse.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « CPLI sans fin prévue ». */

const T = (id, debut, fin) => ({ id, name: id, startDate: debut, endDate: fin, dependencies: [], progress: 0 });

async function cpli(page, taches) {
    return page.evaluate(async ({ taches }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat: '2026-06-10', echeance: '2026-06-30',
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        const p = r.points.find(x => x.n === 13);
        return { finPrevue: r.finPrevue, etat: p.etat, raison: p.raison };
    }, { taches });
}

test('DCMA : sans fin prévue, le CPLI ne dit pas que la fin est passée', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT — LA RAISON « FIN PASSÉE » RESTE CELLE D'UNE FIN PASSÉE.
       Sans ce point, un correctif qui ferait taire « fin-passee » partout
       passerait l'assertion centrale. Passe avant comme après. */
    expect(await cpli(page, [T('A', '2026-06-01', '2026-06-05')]), 'CPLI, fin prévue le 5 juin')
        .toEqual({ finPrevue: '2026-06-05', etat: 'na', raison: 'fin-passee' });

    // --- L'ASSERTION CENTRALE ---
    const vide = await cpli(page, []);
    const sansDates = await cpli(page, [T('X', '', '')]);
    expect({ vide, sansDates }, 'CPLI sans fin prévue').toEqual({
        vide: { finPrevue: null, etat: 'na', raison: 'aucune-tache' },
        sansDates: { finPrevue: null, etat: 'na', raison: 'aucune-tache' },
    });
});
