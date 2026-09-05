#!/usr/bin/env bash
# Rebuilds event-total.json from the R2 snapshots (7-day retention), page by page.
# Usage: pnpm history:backfill  (reads ADMIN_TOKEN from .deploy-secrets.env or the environment)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${ADMIN_TOKEN:-}" ] && [ -f .deploy-secrets.env ]; then
  set -a; . ./.deploy-secrets.env; set +a
fi
: "${ADMIN_TOKEN:?ADMIN_TOKEN is required}"
BASE="${API_BASE:-https://zgoals.xyz}"
after=""
while :; do
  url="$BASE/api/admin/history/backfill?limit=600"
  [ -n "$after" ] && url="$url&after=$after"
  out=$(curl -sS -X POST -H "authorization: Bearer $ADMIN_TOKEN" "$url")
  echo "$out"
  after=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(j.nextAfter||"")})')
  [ -z "$after" ] && break
done
