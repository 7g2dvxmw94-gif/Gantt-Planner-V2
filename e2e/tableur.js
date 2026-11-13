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

/* ---- Vrai classeur .xlsx ----
 *
 *  Le CSV ci-dessus ne dit pas comment Excel STOCKE une date : dans un .xlsx,
 *  une cellule date est un NOMBRE (jours écoulés depuis le 30/12/1899) que
 *  seul un format de cellule désigne comme une date. Rien dans le fichier ne
 *  dit « minuit », ni dans quel fuseau. C'est SheetJS, à la lecture
 *  (`cellDates: true`), qui en fait un objet Date.
 *
 *  Le classeur est écrit ici À LA MAIN, partie par partie, sans bibliothèque
 *  (le dépôt n'en a pas pour l'écriture) et sans SheetJS (l'écrire avec la
 *  bibliothèque même qu'on lit ne prouverait rien sur sa lecture). Il ne
 *  contient que le minimum d'un classeur : une feuille, des textes en ligne
 *  (`inlineStr`), et un style `numFmtId="14"`, le format intégré de date
 *  courte. L'archive est un zip sans compression (méthode 0, « stored »).
 *  Vérifié avec SheetJS 0.20.3, la version que charge l'application : une
 *  cellule date est relue comme un nombre (t 'n', 46181 pour le 08/06/2026)
 *  au format date, et comme une Date avec `cellDates: true` ; une cellule
 *  texte reste une chaîne. */

/** Numéro de série Excel d'une date ISO 'AAAA-MM-JJ'. Calculé en UTC des
 *  deux côtés, donc identique quel que soit le fuseau du processus de test :
 *  les octets du fichier ne dépendent pas de l'endroit où on l'écrit. */
export function serieExcel(iso) {
    const [a, m, j] = iso.split('-').map(Number);
    return (Date.UTC(a, m - 1, j) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const echapperXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function colonne(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
}

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(octets) {
    let c = 0xFFFFFFFF;
    for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Archive zip sans compression. Date des entrées fixe (01/01/1980) : deux
 *  appels identiques donnent les mêmes octets. */
function zipSansCompression(fichiers) {
    const locaux = [];
    const centraux = [];
    let decalage = 0;
    for (const [nom, texte] of fichiers) {
        const n = Buffer.from(nom, 'utf-8');
        const d = Buffer.from(texte, 'utf-8');
        const crc = crc32(d);
        const entete = Buffer.alloc(30);
        entete.writeUInt32LE(0x04034b50, 0);
        entete.writeUInt16LE(20, 4);          // version requise
        entete.writeUInt16LE(0x0800, 6);      // noms en UTF-8
        entete.writeUInt16LE(0, 8);           // méthode 0 : stockée
        entete.writeUInt16LE(0, 10);          // heure
        entete.writeUInt16LE(0x0021, 12);     // 01/01/1980
        entete.writeUInt32LE(crc, 14);
        entete.writeUInt32LE(d.length, 18);
        entete.writeUInt32LE(d.length, 22);
        entete.writeUInt16LE(n.length, 26);
        entete.writeUInt16LE(0, 28);
        locaux.push(entete, n, d);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0x0021, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(d.length, 20);
        central.writeUInt32LE(d.length, 24);
        central.writeUInt16LE(n.length, 28);
        central.writeUInt32LE(decalage, 42);
        centraux.push(central, n);
        decalage += entete.length + n.length + d.length;
    }
    const repertoire = Buffer.concat(centraux);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(fichiers.length, 8);
    fin.writeUInt16LE(fichiers.length, 10);
    fin.writeUInt32LE(repertoire.length, 12);
    fin.writeUInt32LE(decalage, 16);
    return Buffer.concat([...locaux, repertoire, fin]);
}

/** Construit un .xlsx d'une feuille. `lignes` : tableau de lignes, chaque
 *  cellule étant
 *    - une chaîne       → cellule TEXTE (même '2026-06-08' : c'est un texte) ;
 *    - { date: 'AAAA-MM-JJ' } → cellule DATE, stockée comme Excel la stocke :
 *      le numéro de série, avec le style de date courte. */
export function classeurXlsx(lignes) {
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
    const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    const rangs = lignes.map((cellules, l) => {
        const cs = cellules.map((v, c) => {
            const ref = `${colonne(c)}${l + 1}`;
            if (v && typeof v === 'object' && 'date' in v) {
                return `<c r="${ref}" s="1"><v>${serieExcel(v.date)}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${echapperXml(v)}</t></is></c>`;
        }).join('');
        return `<row r="${l + 1}">${cs}</row>`;
    }).join('');

    return zipSansCompression([
        ['[Content_Types].xml', decl +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
            `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.worksheet+xml"/>` +
            `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>` +
            '</Types>'],
        ['_rels/.rels', decl +
            `<Relationships xmlns="${PKG}">` +
            `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
            '</Relationships>'],
        ['xl/workbook.xml', decl +
            `<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>` +
            '<sheet name="Planning" sheetId="1" r:id="rId1"/>' +
            '</sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', decl +
            `<Relationships xmlns="${PKG}">` +
            `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
            `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
            '</Relationships>'],
        ['xl/styles.xml', decl +
            `<styleSheet xmlns="${NS}">` +
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
            '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="2">' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
            '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
            '</cellXfs></styleSheet>'],
        ['xl/worksheets/sheet1.xml', decl +
            `<worksheet xmlns="${NS}"><sheetData>${rangs}</sheetData></worksheet>`],
    ]);
}

/** Importe un vrai .xlsx (octets de classeurXlsx) par le bouton d'import. */
export async function importerXlsx(page, nomProjet, octets) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: `${nomProjet}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: octets,
    });
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
