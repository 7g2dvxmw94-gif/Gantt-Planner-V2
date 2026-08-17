/* Fixtures d'import MS Project, partagées par les specs qui exercent le
   chemin XML (§ G4 du cahier de tests). Extraites de
   import-xml-resources.spec.js pour éviter que deux copies divergent. */

/** Construit une charge MS Project minimale mais réaliste : tâche
 *  récapitulative UID 0, ressource vide UID 0, et les affectations. */
export function xmlMSProject({ nomProjet, nomTache, ressources }) {
    const resLignes = ressources
        .map((nom, i) => `<Resource><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${nom}</Name></Resource>`)
        .join('\n      ');
    const affectations = ressources
        .map((_, i) => `<Assignment><UID>${i}</UID><TaskUID>1</TaskUID><ResourceUID>${i + 1}</ResourceUID></Assignment>`)
        .join('\n      ');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
   <Name>${nomProjet}</Name>
   <Tasks>
      <Task><UID>0</UID><ID>0</ID><Name>${nomProjet}</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>
      <Task><UID>1</UID><ID>1</ID><Name>${nomTache}</Name><OutlineLevel>1</OutlineLevel><Start>2026-09-07T08:00:00</Start><Finish>2026-09-09T17:00:00</Finish><Duration>PT24H0M0S</Duration><PercentComplete>0</PercentComplete></Task>
   </Tasks>
   <Resources>
      <Resource><UID>0</UID><ID>0</ID><Name/></Resource>
      ${resLignes}
   </Resources>
   <Assignments>
      ${affectations}
   </Assignments>
</Project>`;
}

/** L'input file est créé par document.createElement() et jamais inséré dans
 *  le DOM (_importProject, js/app.js) : seul l'événement filechooser permet
 *  de l'atteindre. Le nom doit porter l'extension .xml, le tri se faisant
 *  sur elle. */
export async function importerXML(page, contenu) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#importBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'planning.xml',
        mimeType: 'application/xml',
        buffer: Buffer.from(contenu, 'utf-8'),
    });
}
