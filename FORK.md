# Fork ahmeedatm/orca

Orca de [stablyai/orca](https://github.com/stablyai/orca) avec les ajouts d'Ahmed.

- Base : Orca 1.4.238, commit `8b3c783b77ad53f25c11a888f0f9e811687abe91` (la version installée sur le Mac).
- Branche `ahmed` : la base plus les ajouts ci-dessous. `main` reste le miroir de l'amont.

## Ajouts

- Section « NAS » sous la liste des projets dans la barre gauche
  (`src/renderer/src/components/sidebar/NasPanel.tsx`) : page `https://azru.uk/ck/orca.html`
  (dépôt nas-stacks, `homepage/config/orca.html`) avec les conteneurs en panne, le processeur et la mémoire.
  Partition `persist:orca-browser` : la connexion au portier faite dans un onglet Orca sert au panneau.
  Repliable, choix gardé ; relance après 5 s, 15 s, 1 min puis 5 min si le réseau manque.
  Remplace le patch de `ahmeedatm/orca-panneau-nas`, qui retouchait l'app installée.

## Suivre l'amont

```sh
git fetch upstream --tags
git rebase <nouveau-tag-ou-commit> ahmed
```
