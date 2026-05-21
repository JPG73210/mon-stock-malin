#!/usr/bin/env bash
set -e

CONFIG=/data/options.json
SUPABASE_URL=$(jq -r '.SUPABASE_URL' $CONFIG)
SUPABASE_ANON_KEY=$(jq -r '.SUPABASE_ANON_KEY' $CONFIG)
EMAIL=$(jq -r '.EMAIL' $CONFIG)
PASSWORD=$(jq -r '.PASSWORD' $CONFIG)
PRINTER_IP=$(jq -r '.PRINTER_IP' $CONFIG)
POLL_MS=$(jq -r '.POLL_MS' $CONFIG)

echo "[ha-addon] Démarrage CUPS…"
mkdir -p /var/run/cups /var/spool/cups
/usr/sbin/cupsd -f &
CUPSD_PID=$!
sleep 2

echo "[ha-addon] Ajout imprimante Brother QL-810Wc @ ${PRINTER_IP} (raw 9100)…"
# Driver générique raw : la QL accepte le PDF tel quel via socket 9100.
# Les PDF sont déjà au format mm exact (cf. src/lib/print.ts), donc pas de mise à l'échelle.
lpadmin -p brother_ql -E -v "socket://${PRINTER_IP}:9100" -m raw -o printer-is-shared=false || true
lpoptions -d brother_ql || true
cupsenable brother_ql || true
cupsaccept brother_ql || true

cat > /app/config.json <<EOF
{
  "SUPABASE_URL": "${SUPABASE_URL}",
  "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}",
  "EMAIL": "${EMAIL}",
  "PASSWORD": "${PASSWORD}",
  "PRINTER": "brother_ql",
  "POLL_MS": ${POLL_MS}
}
EOF

echo "[ha-addon] Lancement agent…"
cd /app
exec node agent.mjs
