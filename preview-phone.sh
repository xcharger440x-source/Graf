#!/usr/bin/env bash
# Spusť z této složky: ./preview-phone.sh
# Na telefonu (stejná Wi‑Fi) otevři zobrazenou adresu http://TVÉ_IP:8765

set -e
PORT="${1:-8765}"

ip=""
if command -v ipconfig >/dev/null 2>&1; then
  ip=$(ipconfig getifaddr en0 2>/dev/null || true)
fi
if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
  ip=$(ip route get 1 2>/dev/null | awk '/src/ {print $7; exit}' || true)
fi

echo ""
echo "  Náhled pro telefon (všechna síťová rozhraní, port $PORT)"
if [[ -n "$ip" ]]; then
  echo "  Na telefonu otevři: http://${ip}:${PORT}"
else
  echo "  IP se nepodařilo zjistit automaticky — použij IP tohoto počítače v lokální síti."
fi
echo "  Ukončení: Ctrl+C"
echo ""

cd "$(dirname "$0")"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
