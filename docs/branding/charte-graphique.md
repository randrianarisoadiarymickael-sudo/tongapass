# Charte graphique TongaPass

Le seuil en arche dessiné dans le logo représente le passage d’un collaborateur vers ses outils. L’accueil reprend cette forme dans un visuel en verre lagon. La démonstration juste en dessous permet de comparer une arrivée, une mobilité et un départ sur les mêmes systèmes.

## Couleurs

| Rôle | Thème clair | Thème sombre |
|---|---|---|
| Fond de travail | `#F3F7F6` | `#0B191E` |
| Surface des panneaux | `#FFFFFF` | `#11252B` |
| Texte principal | `#112E32` | `#EFF9F5` |
| Texte secondaire | `#50686B` | `#A1BCB9` |
| Marque et sélection | `#126756` | `#94E8C9` |
| Succès | `#17644D` | `#9BE1BF` |
| En cours | `#285A91` | `#A4C9FA` |
| Échec ou révocation | `#A3303E` | `#FFACB4` |
| Avertissement | `#82520E` | `#F2C87E` |

Le bleu nuit structure la navigation et l’en-tête du tableau de bord dans les deux thèmes. Un libellé accompagne chaque état. Les profils d’accès gardent les couleurs attribuées par l’administrateur.

## Typographie et composants

Plus Jakarta Sans sert aux titres, aux formulaires et à la navigation. IBM Plex Mono distingue les identifiants et les compteurs de progression. Les polices sont servies localement.

Le tableau de bord regroupe la date, l’action de déclaration et le dernier événement reçu. Les indicateurs ouvrent la liste correspondante lorsqu’un filtre existe. Les tableaux larges défilent dans leur panneau sur téléphone. La navigation devient un tiroir et les onglets de la démonstration restent accessibles au clavier.

## Mouvement

| Surface | Déclenchement |
|---|---|
| Exemple public | Le scénario sélectionné se répète à l’écran. Le résultat reste affiché 2,4 secondes avant le prochain passage. |
| Architecture | Sur ordinateur, le signal parcourt les liaisons toutes les cinq secondes. Sur téléphone, les quatre étapes s’éclairent dans le même ordre. |
| Barre supérieure et tableau de bord | Le signal et le fil d’activité réagissent aux événements reçus du serveur. Une coupure affiche l’état de reconnexion. |
| Fiche d’exécution | Une étape en cours est repérée sur la frise. Les marqueurs et la progression changent avec son statut. |

L’accueil suspend ses boucles lorsque la section sort du champ ou que l’onglet est masqué. La commande de pause se trouve en haut de page. Avec `prefers-reduced-motion`, les résultats de l’exemple sont immédiatement lisibles. Le portail continue d’afficher les nouveaux événements et les statuts.

[Logo](logo.svg) · [Bannière](banner.svg) · [Styles du portail](../../apps/portal/src/styles/index.css)
