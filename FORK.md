# Fork ahmeedatm/orca

L'Orca perso d'Ahmed : [stablyai/orca](https://github.com/stablyai/orca) plus ses ajouts à lui, qui ne partent pas chez
l'amont.

- Branche `perso` : le tag de la version d'Orca installée plus les ajouts. `main` reste le miroir de l'amont.
- Un ajout = une branche, puis une PR vers `perso`.
- Le robot qui regreffe cette branche dans Orca.app vit dans [orca-robot](https://github.com/ahmeedatm/orca-robot) (son
  fonctionnement et ses limites sont dans son README). Tout ce qui est poussé sur `perso` s'exécute sur le Mac sous
  15 min.

## Ajouts

- Entrée « Services » dans la navigation du haut de la barre gauche, sous « Tableau de bord des agents »
  (`src/renderer/src/components/sidebar/ServicesSidebarEntry.tsx`), avec les compteurs en erreur, en veille
  et actifs. Un clic ouvre le tiroir `src/renderer/src/components/services/ServicesDrawer.tsx` à côté de la
  barre : services groupés, erreurs en premier, clic sur une ligne = onglet du navigateur d'Orca.
  Le process main lit `GET https://azru.uk/etat/orca.json` (contrat : `src/shared/nas-services.ts`, côté NAS
  dans nas-stacks) avec l'en-tête `X-Orca-Cle`, clé lue dans le trousseau (service `orca-nas-azru`, compte
  `ahmed`) ; la clé ne passe jamais dans le renderer. Relevé toutes les 30 s tant que la barre est ouverte ;
  si le NAS ne répond pas, nouvel essai après 30 s, 1 min, 2 min, puis toutes les 5 min.
  Remplace la section « NAS » (webview de `https://azru.uk/ck/orca.html`) du bas de la barre.
- Paquet Linux x86_64 : `.github/workflows/perso-linux-appimage.yml` construit l'AppImage de `perso` (config
  electron-builder de l'officiel, exécutable `orca-ide`) à chaque push, et la publie en release GitHub
  `perso-v<version>-<sha7>` (`orca-linux-x86_64.AppImage` + `SHA256SUMS`). Sert à un portable Linux. L'updater intégré
  d'Orca pointe toujours vers `stablyai/orca` : sous Linux la mise à jour passe par l'installateur, pas par l'app.
