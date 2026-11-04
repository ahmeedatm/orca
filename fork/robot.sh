#!/bin/bash
# Robot du fork ahmeedatm/orca : regreffe le JavaScript du fork dans /Applications/Orca.app quand Orca a changé de
# version (mise à jour officielle) ou quand la branche ahmed a avancé (nouvel ajout fusionné).
#
#   robot.sh             précommande de l'automatisation Orca (toutes les 15 min, voir installer-robot.sh) : rapide.
#                        Sort en 1 (rien pour l'agent) en lançant au besoin le travail détaché ; sort en 0 (l'agent
#                        démarre) une seule fois par échec nouveau, en affichant la fin du journal.
#   robot.sh --travail   le travail : rebase d'ahmed sur le tag de la version installée, compilation, tests, greffe.
#
# Pourquoi détaché : une précommande est coupée au bout de 10 min au plus, la compilation en prend environ 4.
# Pourquoi lancé par Orca et pas launchd : macOS (« Gestion des apps ») refuse à un script de launchd d'écrire dans
# Orca.app ; lancé par Orca, il en a le droit (vu avec orca-panneau-nas le 2026-11-02).
set -euo pipefail

APP=/Applications/Orca.app
DEPOT="${ORCA_FORK_DEPOT:-$HOME/.local/share/orca-fork/depot}" # clone réservé au robot, jamais édité à la main
DOSSIER_ETAT="$HOME/Library/Logs/orca-fork"
JOURNAL="$DOSSIER_ETAT/robot.log"
ECHEC="$DOSSIER_ETAT/echec"           # raison du dernier échec, en attente d'un agent
ECHEC_SIGNALE="$DOSSIER_ETAT/signale" # dernier échec déjà confié à un agent
VERROU="$DOSSIER_ETAT/travail.verrou"
FORK=https://github.com/ahmeedatm/orca.git
AMONT=https://github.com/stablyai/orca.git
mkdir -p "$DOSSIER_ETAT"

journal() { echo "$(date '+%F %T') $*" >>"$JOURNAL"; }
notifier() { osascript -e "display notification \"$1\" with title \"Orca : fork\"" >/dev/null 2>&1 || true; }
version_installee() { /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist"; }
repere() { /usr/bin/python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' "$APP/Contents/Resources/orca-fork.json" "$1" 2>/dev/null || true; }

echouer() {
  journal "ÉCHEC : $1"
  echo "$(version_installee) $(git -C "$DEPOT" rev-parse origin/ahmed 2>/dev/null || echo ?) $1" >"$ECHEC"
  notifier "Greffe du fork ratée : $1. Un agent va regarder."
  exit 1
}

# La précommande : décide vite, sans jamais compiler.
verifier() {
  if [[ -f "$ECHEC" ]] && ! cmp -s "$ECHEC" "$ECHEC_SIGNALE"; then
    cp "$ECHEC" "$ECHEC_SIGNALE"
    echo "Le robot du fork a échoué : $(cat "$ECHEC")"
    tail -n 60 "$JOURNAL"
    exit 0
  fi
  # Travail déjà en cours ; un verrou de plus de 30 min vient d'un travail tué : on le retire.
  if [[ -d "$VERROU" ]]; then
    [[ -n "$(find "$VERROU" -maxdepth 0 -mmin +30)" ]] || exit 1
    rmdir "$VERROU"
  fi
  local version distant
  version="$(version_installee)"
  distant="$(git ls-remote "$FORK" refs/heads/ahmed | cut -f1)"
  [[ -n "$distant" ]] || { journal "fork injoignable"; exit 1; }
  if [[ "$(repere version)" == "$version" && "$(repere commit)" == "$distant" ]]; then exit 1; fi
  # Même version et même ahmed qu'à l'échec : on attend que l'agent répare (il fera avancer ahmed).
  [[ -f "$ECHEC" && "$(cut -d' ' -f1-2 "$ECHEC")" == "$version $distant" ]] && exit 1
  journal "greffe à refaire : Orca $version, ahmed ${distant:0:10} (en place : $(repere version) $(repere commit | cut -c1-10))"
  # Copie du script : le travail change de commit dans le dépôt, il ne doit pas réécrire le script en cours.
  local copie
  copie="$(mktemp "${TMPDIR:-/tmp}/orca-fork-robot.XXXXXX")"
  cp "$0" "$copie"
  /usr/bin/perl -e 'use POSIX qw(setsid); setsid(); exec @ARGV' /bin/bash "$copie" --travail >>"$JOURNAL" 2>&1 </dev/null &
  exit 1
}

preparer_depot() {
  if [[ ! -d "$DEPOT/.git" ]]; then
    mkdir -p "$(dirname "$DEPOT")"
    git clone --quiet --filter=blob:none "$FORK" "$DEPOT"
    git -C "$DEPOT" remote add upstream "$AMONT"
  fi
  git -C "$DEPOT" fetch --quiet origin ahmed
  git -C "$DEPOT" fetch --quiet upstream "refs/tags/$1:refs/tags/$1" || echouer "tag $1 introuvable chez stablyai/orca"
}

# Recolle ahmed sur le tag de la version installée, et pousse ahmed s'il a fallu le déplacer.
recoller() {
  local tag="$1" base
  base="$(git -C "$DEPOT" describe --tags --abbrev=0 --match 'v[0-9]*' origin/ahmed)"
  git -C "$DEPOT" checkout --quiet --force -B robot origin/ahmed
  [[ "$base" == "$tag" ]] && return 0
  if [[ "$(printf '%s\n%s\n' "${base#v}" "${tag#v}" | sort -V | head -1)" == "${tag#v}" ]]; then
    echouer "Orca installé ($tag) plus ancien que la base du fork ($base) : mettre Orca à jour"
  fi
  journal "rebase d'ahmed : $base -> $tag"
  if ! git -C "$DEPOT" rebase --quiet --onto "$tag" "$base" robot >>"$JOURNAL" 2>&1; then
    git -C "$DEPOT" rebase --abort || true
    echouer "conflit en recollant ahmed de $base sur $tag"
  fi
  git -C "$DEPOT" push --quiet --force-with-lease=ahmed:origin/ahmed origin robot:ahmed || echouer "push d'ahmed refusé"
}

compiler() {
  local pnpm_version tag="$1"
  pnpm_version="$(/usr/bin/python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["packageManager"].split("@")[1].split("+")[0])' "$DEPOT/package.json")"
  local cales
  cales="$(mktemp -d "${TMPDIR:-/tmp}/orca-fork-pnpm.XXXXXX")"
  printf '#!/bin/sh\nexec npx -y pnpm@%s "$@"\n' "$pnpm_version" >"$cales/pnpm"
  chmod +x "$cales/pnpm"
  export PATH="$cales:/opt/homebrew/bin:/usr/local/bin:$PATH"
  cd "$DEPOT"
  pnpm install --frozen-lockfile >>"$JOURNAL" 2>&1 || echouer "pnpm install"
  [[ -d out ]] && rm -r out # de zéro : des fichiers d'une autre version ne doivent pas finir dans la greffe
  # Pas build:mobile-web : la version mobile reste l'officielle (voir greffer.mjs).
  for etape in build:cli build:electron-vite verify:built-skills-cli build:web-from-renderer; do
    pnpm run "$etape" >>"$JOURNAL" 2>&1 || echouer "compilation ($etape)"
  done
  pnpm tc >>"$JOURNAL" 2>&1 || echouer "vérification des types"
  local tests
  tests="$(git diff --name-only "$tag" HEAD -- '*.test.ts' '*.test.tsx' | tr '\n' ' ')"
  if [[ -n "$tests" ]]; then
    # shellcheck disable=SC2086 # une liste de fichiers, voulue
    pnpm test $tests >>"$JOURNAL" 2>&1 || echouer "tests du fork"
  fi
  rm -r "$cales"
}

travailler() {
  [[ "$(basename "$0")" == orca-fork-robot.* ]] && rm -f -- "$0" # copie faite par verifier(), déjà lue par bash
  mkdir "$VERROU" 2>/dev/null || exit 0
  trap 'rmdir "$VERROU"' EXIT
  local version tag
  version="$(version_installee)"
  tag="v$version"
  journal "début : Orca $version"
  preparer_depot "$tag"
  recoller "$tag"
  compiler "$tag"
  local commit
  commit="$(git -C "$DEPOT" rev-parse HEAD)" # égal à origin/ahmed : recoller() a poussé ce qu'il a déplacé
  [[ "$(version_installee)" == "$version" ]] || echouer "Orca a changé de version pendant la compilation"
  node "$DEPOT/fork/greffer.mjs" --app "$APP" --version "$version" --commit "$commit" >>"$JOURNAL" 2>&1 ||
    echouer "greffe"
  rm -f "$ECHEC" "$ECHEC_SIGNALE"
  journal "greffe posée : Orca $version, fork ${commit:0:10}"
  notifier "Ton Orca perso est prêt ($version). Redémarre Orca pour l'utiliser."
}

case "${1:-}" in
  --travail) travailler ;;
  "") verifier ;;
  *) echo "usage : robot.sh [--travail]" >&2; exit 2 ;;
esac
