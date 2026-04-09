#!/usr/bin/env bash
# Spusť z kořene projektu:  ./preview-phone.sh
# (ne ./@preview-phone.sh — soubor se jmenuje preview-phone.sh)
# V prohlížeči na tomto Macu: http://localhost:8765
# Na telefonu (stejná Wi‑Fi): http://TVÉ_IP:8765

set -e
PORT="${1:-8765}"

if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    echo ""
    echo "  Port $PORT už něco poslouchá. Buď ten proces ukonči, nebo zvol jiný port:"
    echo "    ./preview-phone.sh 8766"
    echo ""
    lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P 2>/dev/null || true
    echo ""
    exit 1
  fi
fi

ip=""
if command -v ipconfig >/dev/null 2>&1; then
  ip=$(ipconfig getifaddr en0 2>/dev/null || true)
fi
if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
  ip=$(ip route get 1 2>/dev/null | awk '/src/ {print $7; exit}' || true)
fi

echo ""
echo "  Statický náhled (port $PORT)"
echo "  V prohlížeči na tomto počítači: http://localhost:${PORT}"
echo "                         nebo: http://127.0.0.1:${PORT}"
if [[ -n "$ip" ]]; then
  echo "  Na telefonu (stejná Wi‑Fi): http://${ip}:${PORT}"
else
  echo "  Na telefonu: IP tohoto Macu v lokální síti + :${PORT}"
fi
echo "  Ukončení serveru: Ctrl+C"
echo ""

cd "$(dirname "$0")"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
