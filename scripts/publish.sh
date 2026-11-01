#!/usr/bin/env bash
#
# Crea il repository GitHub, pubblica il contenuto e attiva GitHub Pages.
#
#   GITHUB_TOKEN=... ./scripts/publish.sh [nome-repo]
#
# Il token deve poter creare repository: un classic token con scope "repo"
# e' la via piu' semplice. Il token non viene scritto su disco ne' nei remote:
# viene passato a git tramite credential helper temporaneo.
#
set -euo pipefail

REPO_NAME="${1:-tvsamsung}"
API="https://api.github.com"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Errore: manca GITHUB_TOKEN." >&2
  echo "Uso: GITHUB_TOKEN=ghp_xxx ./scripts/publish.sh [nome-repo]" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      -d "$data" "$API$path" -w '\n%{http_code}'
  else
    curl -sS -X "$method" -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" "$API$path" -w '\n%{http_code}'
  fi
}

echo "1/5  identifico l'utente"
USER_JSON=$(api GET /user)
USER_CODE=$(printf '%s' "$USER_JSON" | tail -1)
if [ "$USER_CODE" != "200" ]; then
  echo "Errore: token non valido (HTTP $USER_CODE)." >&2
  printf '%s\n' "$USER_JSON" | sed '$d' | head -5 >&2
  exit 1
fi
USER_LOGIN=$(printf '%s' "$USER_JSON" | sed '$d' | python3 -c 'import sys,json; print(json.load(sys.stdin)["login"])')
echo "     utente: $USER_LOGIN"

echo "2/5  preparo il commit"
git config user.name "$USER_LOGIN" >/dev/null
git config user.email "${USER_LOGIN}@users.noreply.github.com" >/dev/null
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  git init -b main >/dev/null
fi
git add -A
if ! git diff --cached --quiet; then
  git commit -m "DTV Stream: griglia canali in ordine DTV per smart TV Samsung" >/dev/null
  echo "     commit creato"
else
  echo "     nessuna modifica da committare"
fi

echo "3/5  creo il repository $REPO_NAME"
CREATE=$(api POST /user/repos "{\"name\":\"$REPO_NAME\",\"description\":\"Canali TV italiani in ordine DTV via internet, per smart TV Samsung\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}")
CREATE_CODE=$(printf '%s' "$CREATE" | tail -1)
case "$CREATE_CODE" in
  201) echo "     repository creato" ;;
  422) echo "     repository gia' esistente, proseguo" ;;
  *)   echo "Errore nella creazione (HTTP $CREATE_CODE):" >&2
       printf '%s\n' "$CREATE" | sed '$d' | head -8 >&2
       exit 1 ;;
esac

echo "4/5  carico il codice"
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "https://github.com/$USER_LOGIN/$REPO_NAME.git"
git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f' \
  push -u origin main

echo "5/5  attivo GitHub Pages"
PAGES=$(api POST "/repos/$USER_LOGIN/$REPO_NAME/pages" '{"source":{"branch":"main","path":"/"}}')
PAGES_CODE=$(printf '%s' "$PAGES" | tail -1)
case "$PAGES_CODE" in
  201) echo "     Pages attivato" ;;
  409) echo "     Pages gia' attivo" ;;
  *)   echo "     attivazione automatica non riuscita (HTTP $PAGES_CODE):"
       printf '%s\n' "$PAGES" | sed '$d' | head -6
       echo "     puoi attivarlo a mano: Settings -> Pages -> Branch: main / (root)" ;;
esac

echo
echo "Repository: https://github.com/$USER_LOGIN/$REPO_NAME"
echo "Sito:       https://$USER_LOGIN.github.io/$REPO_NAME/"
echo
echo "La prima pubblicazione di Pages richiede 1-2 minuti."
