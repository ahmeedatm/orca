# Fork ahmeedatm/orca

L'Orca d'Ahmed : [stablyai/orca](https://github.com/stablyai/orca) plus ses ajouts à lui, qui ne partent pas chez
l'amont.

- Branche `ahmed` : le tag de la version d'Orca installée (`v1.4.238` aujourd'hui) plus les ajouts. `main` reste le
  miroir de l'amont.
- Un ajout = une branche, puis une PR vers `ahmed`.

## Ajouts

- Section « NAS » sous la liste des projets dans la barre gauche
  (`src/renderer/src/components/sidebar/NasPanel.tsx`) : page `https://azru.uk/ck/orca.html`
  (dépôt nas-stacks, `homepage/config/orca.html`) avec les conteneurs en panne, le processeur et la mémoire.
  Partition du navigateur d'Orca : la connexion au portier faite dans un onglet Orca sert au panneau.
  Remplace le patch de `ahmeedatm/orca-panneau-nas`.

## Le robot (`fork/`)

Orca garde ses mises à jour officielles. Après chacune, le robot remet les ajouts :

1. `robot.sh` tourne toutes les 15 min (automatisation Orca « Fork Orca : greffe après mise à jour »). Il compare la
   version installée et la branche `ahmed` avec le repère `Contents/Resources/orca-fork.json` de l'app.
2. S'il faut regreffer : il recolle `ahmed` sur le tag de la nouvelle version (et pousse `ahmed`), compile le
   JavaScript, vérifie les types et lance les tests du fork. Il travaille dans son propre clone,
   `~/.local/share/orca-fork/depot`.
3. `greffer.mjs` remplace `app.asar` dans `/Applications/Orca.app`, sur place. Il garde l'exécutable et la signature
   d'Apple : macOS reconnaît toujours Orca (autorisations, trousseau). Une notification demande de redémarrer Orca.
4. En cas d'échec (conflit, compilation, tests), l'automatisation lance un agent Claude dans ce dépôt pour réparer.
   Journal : `~/Library/Logs/orca-fork/robot.log`.

Installer ou réinstaller : `fork/installer-robot.sh`, depuis un terminal d'Orca. macOS ne laisse qu'Orca écrire
dans Orca.app.

## Limites

- Seulement du JavaScript (barres gauche et droite, écrans, logique de `src/main`) : le natif reste celui d'Apple.
  La version mobile n'est pas recompilée (elle reste l'officielle).
- La greffe rompt le sceau des ressources : une copie neuve d'Orca greffée serait refusée par macOS (« endommagé »).
  Sur place, dans une app déjà ouverte une fois, Orca démarre.
- Si Orca allume un jour le fusible `EnableEmbeddedAsarIntegrityValidation`, `greffer.mjs` refuse de greffer.
- Pas encore vu en vrai : la mise à jour officielle d'une app greffée. Filet : si Orca reste 3 jours derrière la
  dernière version, le robot lance un agent.
- Tout ce qui est poussé sur `ahmed` s'exécute sur le Mac sous 15 min, avec le droit d'écrire dans Orca.app : le
  compte GitHub `ahmeedatm` est la seule porte, à garder sous double authentification.
- Entre une mise à jour officielle et la greffe suivante (15 min au plus, plus la compilation), Orca tourne sans
  les ajouts.
