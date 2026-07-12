#!/bin/bash
cd "$(dirname "$0")"
PORT=8000
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "IP_DEL_MAC")
echo ""
echo "=============================================="
echo " DVS Gestionale - Anteprima iPhone"
echo "=============================================="
echo ""
echo "1. Lascia aperta questa finestra."
echo "2. Collega Mac e iPhone alla stessa rete Wi-Fi."
echo "3. Su iPhone apri Safari e vai a:"
echo ""
echo "   http://$IP:$PORT"
echo ""
echo "Per fermare l'anteprima premi CTRL+C oppure chiudi questa finestra."
echo ""
python3 -m http.server "$PORT"
