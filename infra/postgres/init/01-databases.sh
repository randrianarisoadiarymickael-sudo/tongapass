#!/bin/sh
# Une base et un utilisateur dédiés par service (cloisonnement / moindre privilège).
# Exécuté une seule fois, au premier démarrage du volume PostgreSQL.
set -eu

create_db() {
  role="$1"; password="$2"; database="$3"
  echo "→ base ${database} (propriétaire ${role})"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    --set=role="$role" --set=password="$password" --set=database="$database" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'database', :'role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database') \gexec
SQL
}

create_db "$TP_DB_USER" "$TP_DB_PASSWORD" tongapass
create_db "$TP_DB_USER" "$TP_DB_PASSWORD" tongapass_test
create_db keycloak "$KEYCLOAK_DB_PASSWORD" keycloak
create_db n8n "$N8N_DB_PASSWORD" n8n
create_db gitea "$GITEA_DB_PASSWORD" gitea
create_db mattermost "$MATTERMOST_DB_PASSWORD" mattermost
echo "Bases TongaPass initialisées."
