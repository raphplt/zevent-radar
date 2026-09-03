#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER="$ROOT/apps/worker"
SECRETS="${1:-$ROOT/.deploy-secrets.env}"
cd "$WORKER"

if [ ! -f "$SECRETS" ]; then
  echo "Fichier de secrets introuvable : $SECRETS"
  echo "Attendu : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ADMIN_TOKEN, TURNSTILE_SECRET_KEY (optionnel)"
  exit 1
fi
set -a; . "$SECRETS"; set +a

pnpm exec wrangler whoami >/dev/null 2>&1 || { echo "Lance d'abord : pnpm exec wrangler login"; exit 1; }

echo "== D1"
if ! pnpm exec wrangler d1 list --json | grep -q '"name": "zevent-radar"'; then
  pnpm exec wrangler d1 create zevent-radar >/dev/null
fi
DB_ID=$(pnpm exec wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s).find(x=>x.name==="zevent-radar");console.log(d.uuid)})')
sed -i "s/\"database_id\": \"[^\"]*\"/\"database_id\": \"$DB_ID\"/" wrangler.jsonc
echo "   database_id=$DB_ID"

echo "== R2"
pnpm exec wrangler r2 bucket list 2>/dev/null | grep -q '^name: *zevent-radar-data' || pnpm exec wrangler r2 bucket create zevent-radar-data
pnpm exec wrangler r2 bucket lifecycle add zevent-radar-data --prefix snapshots/ --expire-days 7 --force >/dev/null 2>&1 || true
cat > /tmp/zr-cors.json <<JSON
[{"AllowedOrigins":["https://zgoals.xyz","https://www.zgoals.xyz","http://localhost:5173"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
JSON
pnpm exec wrangler r2 bucket cors set zevent-radar-data --file /tmp/zr-cors.json --force >/dev/null 2>&1 || true

if [ -n "${ZONE_ID:-}" ]; then
  echo "== Domaine data.zgoals.xyz sur R2"
  pnpm exec wrangler r2 bucket domain add zevent-radar-data --domain data.zgoals.xyz --zone-id "$ZONE_ID" --force >/dev/null 2>&1 || echo "   (déjà attaché ou zone introuvable)"
fi

echo "== Queue"
pnpm exec wrangler queues list 2>/dev/null | grep -q 'zevent-radar-notifications' || pnpm exec wrangler queues create zevent-radar-notifications

echo "== Secrets"
for k in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY ADMIN_TOKEN; do
  printf '%s' "${!k}" | pnpm exec wrangler secret put "$k" >/dev/null
done
if [ -n "${TURNSTILE_SECRET_KEY:-}" ]; then
  printf '%s' "$TURNSTILE_SECRET_KEY" | pnpm exec wrangler secret put TURNSTILE_SECRET_KEY >/dev/null
fi

echo "== Migrations"
pnpm exec wrangler d1 migrations apply zevent-radar --remote

echo "== Déploiement"
cd "$ROOT" && pnpm deploy

echo "== Initialisation des données"
API="https://zgoals.xyz"
for i in 1 2 3 4 5 6; do curl -sf -o /dev/null "$API/api/health" && break || sleep 10; done
curl -sf -X POST -H "authorization: Bearer $ADMIN_TOKEN" "$API/api/admin/collect"; echo
curl -sf -X POST -H "authorization: Bearer $ADMIN_TOKEN" "$API/api/admin/goals/sync"; echo
curl -sf -X POST -H "authorization: Bearer $ADMIN_TOKEN" "$API/api/admin/collect"; echo
curl -s "$API/api/health"; echo
echo "Terminé. Reste côté dashboard : règle de cache sur data.zgoals.xyz, Turnstile, Access (voir docs/DEPLOY.md)."
