#!/bin/sh
# Démarre Gitea puis crée (une seule fois) le compte d'administration utilisé par n8n.
set -eu
CONFIG=/etc/gitea/app.ini

/usr/local/bin/gitea -c "$CONFIG" web &
GITEA_PID=$!

echo "[gitea-bootstrap] attente de l'API…"
until wget -q -O /dev/null http://127.0.0.1:3000/api/healthz; do sleep 2; done

if /usr/local/bin/gitea -c "$CONFIG" admin user list --admin | grep -q " ${GITEA_ADMIN_USER} "; then
  echo "[gitea-bootstrap] administrateur ${GITEA_ADMIN_USER} déjà présent"
else
  /usr/local/bin/gitea -c "$CONFIG" admin user create --admin \
    --username "$GITEA_ADMIN_USER" --password "$GITEA_ADMIN_PASSWORD" \
    --email "${GITEA_ADMIN_USER}@tongapass.local" --must-change-password=false
  echo "[gitea-bootstrap] administrateur ${GITEA_ADMIN_USER} créé"
fi

wait "$GITEA_PID"
