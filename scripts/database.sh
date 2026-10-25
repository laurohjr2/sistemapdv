#!/usr/bin/env bash
set -euo pipefail
cd /workspace/sistemapdv
created=false
if ! docker container inspect pdv-dev-db >/dev/null 2>&1; then
  docker run --name pdv-dev-db -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=bar_management -p 127.0.0.1:5432:5432 -d postgres@sha256:9e2cf6287f25c3151f4c9421ccce2b17f3e60061c111a29165e0d2cdd9ff0a97 >/dev/null
  created=true
else
  docker start pdv-dev-db >/dev/null
fi
for attempt in $(seq 1 30); do
  if docker exec pdv-dev-db pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec pdv-dev-db pg_isready -U postgres
if "$created" && test -s .pdv-local/development.sql; then
  docker exec -i pdv-dev-db psql -v ON_ERROR_STOP=1 -U postgres bar_management < .pdv-local/development.sql >/dev/null
fi
