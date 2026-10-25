#!/usr/bin/env bash
set -euo pipefail
cd /workspace/sistemapdv
bash scripts/database.sh
node scripts/init-dev.cjs
root=$PWD
api_port=${PDV_API_PORT:-3000}
web_port=${PDV_WEB_PORT:-5173}
mkdir -p .pdv-local
start_service() {
  local service=$1 directory=$2
  shift 2
  local pid_file="$root/.pdv-local/$service-$api_port-$web_port.pid"
  if test -f "$pid_file" && kill -0 "$(cat "$pid_file")" 2>/dev/null && [[ $(ps -p "$(cat "$pid_file")" -o stat=) != *Z* ]]; then return; fi
  (cd "$directory"; exec nohup "$@" > "$root/.pdv-local/$service.log" 2>&1) &
  echo $! > "$pid_file"
}
start_service api "$root/bar-management-system" env PORT="$api_port" node --env-file="$root/.pdv-local/development.env" server.js
start_service frontend "$root/bar-frontend" env PDV_API_TARGET="http://127.0.0.1:$api_port" node node_modules/vite/bin/vite.js --host 0.0.0.0 --port "$web_port" --strictPort
for attempt in $(seq 1 30); do
  if curl --silent --fail --max-time 2 "http://127.0.0.1:$web_port/api/health" >/dev/null; then
    echo "Interface e API respondendo nas portas $web_port e $api_port. Valide com PDV_API_URL=http://127.0.0.1:$web_port/api node --env-file=.pdv-local/development.env scripts/smoke.mjs"
    exit 0
  fi
  sleep 1
done
echo 'Falha na inicialização. Consulte .pdv-local/api.log e frontend.log.' >&2
exit 1
