#!/bin/sh
# Point d'entrée du conteneur n8n de TongaPass.
# À chaque démarrage, les workflows versionnés dans Git sont réimportés puis activés :
# le dépôt reste la source de vérité (approche « workflows as code »).
set -eu
DIR=/opt/tongapass
CREDS=/tmp/tongapass-credentials.json

echo "[tongapass] import des identifiants (chiffrés par n8n)…"
node "$DIR/render-credentials.mjs" > "$CREDS"
n8n import:credentials --input="$CREDS"
rm -f "$CREDS"

echo "[tongapass] import des workflows…"
n8n import:workflow --separate --input="$DIR/workflows"

# n8n 2.x : un sous-workflow doit être publié avant les workflows qui l'appellent.
for id in tpCallback000001 tpOnboarding0001 tpMobility000001 tpOffboarding001; do
  if n8n publish:workflow --id="$id" > /tmp/publish.log 2>&1; then
    echo "[tongapass] workflow $id publié"
  else
    echo "[tongapass] ÉCHEC de publication du workflow $id :"
    tail -3 /tmp/publish.log
  fi
done

echo "[tongapass] démarrage de n8n"
exec n8n start
