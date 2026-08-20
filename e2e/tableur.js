/* Fixtures d'import tableur, pour les specs qui exercent le chemin Excel
   (TEST_PLAN.md § G5). */

/** Construit une charge tableur : en-têtes puis lignes.
 *
 *  Le contenu est du CSV, et ce n'est pas un raccourci paresseux :
 *  _importExcelFile() passe les octets à XLSX.read(), qui renifle le format.
 *  Vérifié contre la version réellement chargée par l'application
 *  (xlsx-0.20.3) : le CSV est lu comme un classeur d'une feuille, et
 *  sheet_to_json en tire les mêmes lignes qu'un .xlsx.
 *
 *  Les en-têtes sont VOLONTAIREMENT sans accent. Les octets sont interprétés
 *  en latin1 par SheetJS : « Début » ressort « DÃ©but », que la détection de
 *  colonnes de store.js (qui cherche « debut ») ne reconnaît pas. La colonne
 *  serait ignorée et les dates perdues, sans le moindre message. */
export function tableurProjet({ taches }) {
    const lignes = taches.map(t =>
        [t.nom, t.debut, t.fin, t.phase || '', t.ressource || '', t.avancement ?? 0].join(',')
    );
    return ['Nom,Debut,Fin,Phase,Ressource,Avancement', ...lignes].join('\n');
}

/** Le nom du fichier DEVIENT le nom du projet : importFromExcel() le dérive
 *  par `fileName.replace(/\.(xlsx|xls)$/i, '').replace(/_/g, ' ')`. C'est
 *  donc lui qui doit porter l'horodatage, la CI partageant un seul compte. */
export async function importerTableur(page, nomProjet, contenu) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: `${nomProjet}.xls`,
        mimeType: 'application/vnd.ms-excel',
        buffer: Buffer.from(contenu, 'utf-8'),
    });
}
