import { test, expect } from '../fixtures.js';
import { waitForAppReady } from '../helpers.js';

/* Couvre TEST_PLAN.md § E2 (chemin critique), sous l'angle du CPLI
 * (point 13) du rapport DCMA 14 points.
 *
 * LE DÉFAUT : quand aucun jour ouvré ne sépare la date d'état de la fin
 * prévue, le CPLI dit que la fin prévue est passée.
 *
 *     const cpl = finPrevue ? workingDaysBetween(dateEtat, finPrevue, cal) : 0;
 *     …
 *     } else if (cpl <= 0) { … raison: 'fin-passee' }
 *
 * workingDaysBetween() compte les jours ouvrés de l'intervalle FERMÉ
 * [date d'état, fin prévue], et rend 0 quand la fin précède la date
 * d'état — le cas que visait la branche. Mais il rend 0 aussi quand
 * l'intervalle ne contient aucun jour ouvré : date d'état le samedi et
 * fin prévue le dimanche, ou les deux le même samedi. La remarque affichée
 * est alors « la fin prévue précède la date d'état », ce qui est faux : la
 * fin est à la date d'état ou après. L'état, « non mesurable », est juste
 * — le CPL est au dénominateur ; seule la raison ment.
 *
 * NI L'UNE NI L'AUTRE DATE N'EST EXOTIQUE. Sans date d'état de projet, le
 * rapport prend la date du jour, samedi compris (app.js,
 * _dcmaPresentation). La fin prévue est la plus grande date de fin
 * enregistrée, prise telle quelle ; le store sait qu'une tâche peut être
 * posée sur un jour non ouvré — previewWorkingDaysImpact() les recense.
 *
 * TROUVÉ PAR LA RELECTURE CONTRADICTOIRE de la fonctionnalité DCMA,
 * reproduit par son contradicteur.
 *
 * LES PLANNINGS : une seule tâche A, du lundi 1er juin 2026 à la date de
 * fin du cas, et une échéance au mardi 30 juin. JUIN 2026 COMMENCE UN
 * LUNDI : le 5 est un vendredi, les 6 et 7 un samedi et un dimanche, le 8
 * un lundi.
 *
 * LE ROUGE ATTENDU POUR LE COMMIT DE TEST : un échec, sur l'assertion
 * centrale — « CPLI sans jour ouvré restant ». */

const ECHEANCE = '2026-06-30';
const A = (fin) => ({ id: 'A', name: 'A', startDate: '2026-06-01', endDate: fin, dependencies: [], progress: 0 });

/** Le point 13 pour une date d'état et une fin prévue, avec le vrai module
 *  et le vrai moteur chargés dans la page. */
async function cpli(page, dateEtat, fin) {
    return page.evaluate(async ({ dateEtat, taches, echeance }) => {
        const base = document.baseURI;
        const utils = await import(new URL('js/utils.js', base).href);
        const { store } = await import(new URL('js/store.js', base).href);
        const { evaluerDcma } = await import(new URL('js/dcma.js', base).href);
        const cal = utils.defaultCalendar();
        const moteur = Object.assign(Object.create(Object.getPrototypeOf(store)), {
            getTasks: () => taches, getTask: (id) => taches.find(t => t.id === id), _getCalendar: () => cal,
        });
        const r = evaluerDcma({ taches, calendrier: cal, dateEtat, echeance,
            analyse: moteur.analyzeNetwork(), placer: (t, g) => moteur.computeConstrainedDatesIn(t, g) });
        const p = r.points.find(x => x.n === 13);
        return { finPrevue: r.finPrevue, valeur: p.valeur, etat: p.etat, raison: p.raison ?? null };
    }, { dateEtat, taches: [A(fin)], echeance: ECHEANCE });
}

test('DCMA : sans jour ouvré jusqu\'à la fin prévue, le CPLI ne dit pas que la fin est passée', async ({ page }) => {
    await page.goto('index.html');
    await waitForAppReady(page);

    /* DISCRIMINANT 1 — LE WEEK-END DU TEST EN EST UN. Le vendredi 5 et le
       lundi 8 sont ouvrés, le samedi 6 et le dimanche 7 ne le sont pas, et
       l'intervalle fermé du samedi au dimanche compte zéro jour ouvré. Sans
       ce point, un échec central pourrait venir d'un calendrier ou d'une
       lecture de date décalée d'un jour, et non du défaut. Passe avant
       comme après. */
    const semaine = await page.evaluate(async () => {
        const utils = await import(new URL('js/utils.js', document.baseURI).href);
        const cal = utils.defaultCalendar();
        return {
            ouvres: ['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08'].map(d => utils.isWorkingDay(d, cal)),
            samediDimanche: utils.workingDaysBetween('2026-06-06', '2026-06-07', cal),
            memeSamedi: utils.workingDaysBetween('2026-06-06', '2026-06-06', cal),
        };
    });
    expect(semaine, 'calendrier du 5 au 8 juin 2026')
        .toEqual({ ouvres: [true, false, false, true], samediDimanche: 0, memeSamedi: 0 });

    /* DISCRIMINANT 2 — UNE FIN VRAIMENT PASSÉE RESTE « FIN PASSÉE ». Fin
       prévue le vendredi 5, date d'état le lundi 8. Sans ce point, un
       correctif qui ferait taire « fin-passee » partout passerait
       l'assertion centrale. Passe avant comme après. */
    expect(await cpli(page, '2026-06-08', '2026-06-05'), 'CPLI, fin vendredi 5, date d\'état lundi 8')
        .toEqual({ finPrevue: '2026-06-05', valeur: null, etat: 'na', raison: 'fin-passee' });

    /* DISCRIMINANT 3 — LE MIROIR DU CAS CENTRAL RESTE « FIN PASSÉE ». Fin
       prévue le samedi 6, date d'état le dimanche 7 : aucun jour ouvré
       entre les deux non plus, mais cette fois la fin précède la date
       d'état. Sans ce point, un correctif qui trancherait sur le compte de
       jours ouvrés plutôt que sur l'ordre des dates passerait l'assertion
       centrale. Passe avant comme après. */
    expect(await cpli(page, '2026-06-07', '2026-06-06'), 'CPLI, fin samedi 6, date d\'état dimanche 7')
        .toEqual({ finPrevue: '2026-06-06', valeur: null, etat: 'na', raison: 'fin-passee' });

    /* DISCRIMINANT 4 — UNE DATE D'ÉTAT UN SAMEDI NE CASSE PAS LE CPLI À
       ELLE SEULE. Date d'état le samedi 6, fin prévue le lundi 8 : un jour
       ouvré reste, et le CPLI se calcule contre l'échéance. Sans ce point,
       l'échec central pourrait venir de ce que le module refuse toute date
       d'état non ouvrée, ou ne voit pas l'échéance. Passe avant comme
       après. */
    expect(await cpli(page, '2026-06-06', '2026-06-08'), 'CPLI, date d\'état samedi 6, fin lundi 8')
        .toEqual({ finPrevue: '2026-06-08', valeur: 17, etat: 'ok', raison: null });

    // --- L'ASSERTION CENTRALE ---
    const samediDimanche = await cpli(page, '2026-06-06', '2026-06-07');
    const memeSamedi = await cpli(page, '2026-06-06', '2026-06-06');
    expect({ samediDimanche, memeSamedi }, 'CPLI sans jour ouvré restant').toEqual({
        samediDimanche: { finPrevue: '2026-06-07', valeur: null, etat: 'na', raison: 'sans-jour-ouvre-restant' },
        memeSamedi: { finPrevue: '2026-06-06', valeur: null, etat: 'na', raison: 'sans-jour-ouvre-restant' },
    });
});
