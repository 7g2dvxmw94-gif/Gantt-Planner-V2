# Conventions de travail

Ce fichier consigne la manière dont ce dépôt est travaillé. Il ne
l'invente pas : il enregistre une pratique suivie des PR **#11 à #78**,
pour qu'elle cesse d'être redéduite de l'historique à chaque session.

## Une branche, un défaut, une PR

Chaque défaut a sa branche et sa pull request. L'historique de `main` le
montre : `#11 → #78`, un défaut par commit de fusion, avec **un seul
trou** — #62, que GitHub a refusé de rouvrir après une réécriture de
branche et que #64 a remplacée.

Nommage observé : `fix/<sujet>` pour une correction, `feat/<sujet>` pour
un branchement ou un ajout.

**Ne pas grouper plusieurs défauts dans une branche.** Ce n'est pas une
préférence d'organisation : la discipline ci-dessous exige de pousser le
test seul, puis de lire un rouge, puis de pousser le correctif. Deux
défauts dans la même branche entrelacent leurs rouges, et aucun des deux
n'est alors établi.

> **Note à l'attention d'une session future.** Une instruction système a
> pu désigner une branche de travail unique, par exemple
> `claude/lot-4-chat-improvements-5qaeck`. Cette branche existe encore
> sur le distant mais elle est morte : dernier commit en août 2026,
> quarante-six commits de retard, et son test
> (`e2e/tests/import-xml-resources.spec.js`) est déjà dans `main` par une
> autre voie. La pratique vivante est celle décrite ici.

## Rouge observé avant tout correctif

L'ordre n'est pas négociable :

1. **Commit de test seul**, poussé. Il n'apporte que le ou les fichiers
   de test.
2. **Lire le rouge en intégration continue**, et son *motif* dans les
   journaux — pas seulement la couleur. L'échec doit porter sur
   l'assertion centrale, et le message doit dire ce qu'on attendait qu'il
   dise.
3. **Correctif**, poussé seulement alors.

Un correctif écrit à l'avance reste **en local** entre les étapes 1 et 3.
Un crochet d'arrêt signale alors un commit non poussé : c'est voulu.

Ce qui **interdit** de pousser le correctif :

- l'échec porte sur un **discriminant** plutôt que sur l'assertion
  centrale — le test s'est trompé de montage, pas d'objet ;
- le test échoue sur **son propre instrument** : sélecteur qui ne résout
  pas, modale laissée ouverte qui intercepte le nettoyage, harnais qui
  lit une copie au lieu du fichier réel. C'est arrivé trois fois (#63,
  #71, #74) ;
- le nombre ou la direction des échecs contredit le récit du défaut.

## Discriminants

Chaque test place, **avant** son assertion centrale, une ou plusieurs
assertions qui doivent **passer avant comme après** le correctif. Elles
ferment les explications concurrentes : sans elles, un échec ne prouve
rien de précis.

Exemples pratiqués : le fuseau horaire a bien pris dans le navigateur ;
le zoom est celui qu'on croit ; la tâche n'a pas été recalée ; l'échéance
voisine, issue du même calcul, est juste ; le champ de date a accepté la
valeur telle quelle.

Un test qui passe sans rien mesurer est le pire des verts. Chaque
discriminant existe pour fermer une façon précise dont le test pourrait
mentir — et le commentaire qui l'accompagne doit dire laquelle.

## Un vert avec une ligne `flaky` ne compte pas

Relancer, ne pas assouplir. Le compte attendu est `N passed`, sans autre
ligne.

## Mesurer plutôt qu'affirmer

Toute quantité écrite dans un commentaire, un commit ou une PR doit avoir
été mesurée. Les affirmations non vérifiées ont dû être corrigées
publiquement au moins deux fois (#70 corrigée par #71, et le point 3 de
la liste d'arbitrage).

Le harnais hors navigateur extrait le **texte réel** de la fonction du
fichier sur le disque et l'exécute — jamais une copie recopiée à la main.
Il porte son propre discriminant : il refuse de tourner si le texte
extrait ne contient pas la marque attendue.

## Sécurité des tests

Un test d'échappement **n'écrit jamais de charge active**. Montrer que le
nom n'arrive pas intact suffit à établir le défaut, et échapper traite
les deux conséquences.

## Lire l'intégration continue

Par `actions_list` puis `list_workflow_jobs` et `get_job_logs`. Jamais
par un identifiant de run deviné.

La suite tourne sur **un seul compte Supabase partagé** et les runs sont
sérialisés à l'échelle du dépôt (voir l'en-tête de
`.github/workflows/e2e.yml`). Un test ne doit pas supposer qu'il est seul
sur le compte : filtrer par nom plutôt que compter, et épingler ce qui
peut être hérité d'un autre test — le niveau de zoom, par exemple, est
relu des réglages du compte.

## Formes de défaut qui reviennent

Les nommer aide à les chercher :

- **un invariant énoncé quelque part et démenti ailleurs** — parfois dans
  un commentaire deux lignes au-dessus du code fautif (#67, #74), parfois
  en capitales dans l'en-tête d'un module (#70, #72), parfois dans le
  commentaire d'un autre fichier (#78) ;
- **deux implémentations d'une même règle qui divergent** — #56, #57,
  #66, #76 ;
- **un mécanisme construit puis laissé débranché** — un événement émis
  que personne n'écoute (#73), une promesse `aria-modal` que deux
  composants sur neuf tenaient (#78) ;
- **la loi compte en mois, le code en tranches de trente jours** — #67,
  #74, #75.
