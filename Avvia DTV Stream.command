#!/bin/bash
# Doppio clic per avviare DTV Stream sul computer.
# Poi apri sul televisore l'indirizzo che compare nella finestra.

cd "$(dirname "$0")" || exit 1

echo ""
echo "  Avvio DTV Stream..."
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "  Python 3 non trovato. Installalo da https://www.python.org/downloads/"
  echo ""
  read -n 1 -s -r -p "  Premi un tasto per chiudere."
  exit 1
fi

exec python3 proxy/serve.py
