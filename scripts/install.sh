#!/usr/bin/env bash
set -euo pipefail
cd /workspace/sistemapdv/bar-management-system
npm ci --cache /tmp/pdv-npm-cache --no-audit --no-fund
cd ../bar-frontend
npx --yes --cache /tmp/pdv-npm-cache pnpm@10.4.1 install --frozen-lockfile --store-dir /workspace/.pdv-pnpm-store-v10
npm rebuild esbuild @tailwindcss/oxide --cache /tmp/pdv-npm-cache
npm run build
cd ..
bash scripts/database.sh
node scripts/init-dev.cjs
