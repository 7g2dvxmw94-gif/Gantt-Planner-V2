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

/** Variante portant des liens de précédence. Volontairement SÉPARÉE de
 *  xmlMSProject() plutôt qu'ajoutée en paramètre optionnel : deux specs
 *  déjà vertes dépendent de la sortie exacte de celle-ci, et les liens
 *  imposent plusieurs tâches là où elle n'en produit qu'une.
 *
 *  `taches` : [{ nom, predecesseurs?: [{ uid, type }] }]. Les UID sont
 *  attribués 1..n dans l'ordre du tableau, l'UID 0 restant la tâche
 *  récapitulative. `type` est la valeur NUMÉRIQUE de MS Project — voir la
 *  table de correspondance dans store.js (_typeLienMSProject). */
export function xmlMSProjectAvecLiens({ nomProjet, taches }) {
    const lignes = taches.map((tache, i) => {
        const uid = i + 1;
        const liens = (tache.predecesseurs || []).map(p =>
            `<PredecessorLink><PredecessorUID>${p.uid}</PredecessorUID>` +
            `<Type>${p.type}</Type><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`
        ).join('');
        return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${tache.nom}</Name>` +
            `<OutlineLevel>1</OutlineLevel>` +
            `<Start>2026-09-0${uid}T08:00:00</Start><Finish>2026-09-0${uid}T17:00:00</Finish>` +
            `<Duration>PT8H0M0S</Duration><PercentComplete>0</PercentComplete>${liens}</Task>`;
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

/** Variante permettant de composer une ARBORESCENCE arbitraire, y compris
 *  des niveaux qui sautent et des lignes nulles. Séparée des deux autres
 *  pour la même raison : des specs vertes dépendent de leur sortie exacte.
 *
 *  `taches` : [{ nom?, niveau, sommaire?, nulle? }]. Les UID sont attribués
 *  1..n dans l'ordre, l'UID 0 restant la tâche récapitulative.
 *
 *  `nulle: true` produit une ligne <IsNull>1</IsNull> SANS <Name>, telle que
 *  MS Project marque une ligne vide du planning (documenté pour Task et
 *  Resource). C'est volontairement le cas le plus hostile : sans nom, le
 *  repli « Tâche sans nom » de l'import la rend indistinguable d'une vraie
 *  tâche. */
export function xmlMSProjectArborescence({ nomProjet, taches }) {
    const lignes = taches.map((t, i) => {
        const uid = i + 1;
        if (t.nulle) {
            return `<Task><UID>${uid}</UID><ID>${uid}</ID>` +
                `<OutlineLevel>${t.niveau}</OutlineLevel><IsNull>1</IsNull></Task>`;
        }
        return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${t.nom}</Name>` +
            `<OutlineLevel>${t.niveau}</OutlineLevel>` +
            (t.sommaire ? `<Summary>1</Summary>` : '') +
            `<Start>2026-10-05T08:00:00</Start><Finish>2026-10-06T17:00:00</Finish>` +
            `<Duration>PT16H0M0S</Duration><PercentComplete>0</PercentComplete></Task>`;
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
