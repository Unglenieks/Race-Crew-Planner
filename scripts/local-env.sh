#!/usr/bin/env bash
# Start, inspect, or remove a local, non-production Race Crew Planner stack
# (self-hosted Convex + dashboard + web) with Docker Compose.
# See docs/local-environments.md. Never point this at Railway or production.
#
#   scripts/local-env.sh up       start Convex, publish convex/, build and start web
#   scripts/local-env.sh deploy   republish convex/ to the running local backend
#   scripts/local-env.sh status   show containers and health
#   scripts/local-env.sh down     stop and delete containers and data
#
# Settings (environment; defaults suit one stack on a workstation):
#   RCP_LOCAL_PROJECT   compose project name, one per stack (default rcp-local)
#   RCP_WEB_PORT, RCP_CONVEX_PORT, RCP_CONVEX_SITE_PORT, RCP_DASHBOARD_PORT
#   RCP_BIND            host address to publish on (default 127.0.0.1)
#   RCP_CONVEX_URL      browser-facing Convex URL (default http://127.0.0.1:$RCP_CONVEX_PORT)
#   RCP_CONVEX_SITE_URL browser-facing HTTP-actions URL
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_JWT_ISSUER_DOMAIN
#                       Clerk *development* instance values; without them the
#                       app runs signed-out only.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
compose_file="$root/deploy/local/compose.yaml"

export RCP_LOCAL_PROJECT="${RCP_LOCAL_PROJECT:-rcp-local}"
export RCP_BIND="${RCP_BIND:-127.0.0.1}"
export RCP_WEB_PORT="${RCP_WEB_PORT:-3000}"
export RCP_CONVEX_PORT="${RCP_CONVEX_PORT:-3210}"
export RCP_CONVEX_SITE_PORT="${RCP_CONVEX_SITE_PORT:-3211}"
export RCP_DASHBOARD_PORT="${RCP_DASHBOARD_PORT:-6791}"
export RCP_CONVEX_URL="${RCP_CONVEX_URL:-http://127.0.0.1:$RCP_CONVEX_PORT}"
export RCP_CONVEX_SITE_URL="${RCP_CONVEX_SITE_URL:-http://127.0.0.1:$RCP_CONVEX_SITE_PORT}"
export NEXT_PUBLIC_RELEASE_SHA="${NEXT_PUBLIC_RELEASE_SHA:-$(git -C "$root" rev-parse HEAD 2>/dev/null || true)}"

# Local CLI access to the backend, reached from this host.
local_convex="http://127.0.0.1:$RCP_CONVEX_PORT"

dc() { docker compose -f "$compose_file" "$@"; }

admin_key() {
  # The key is printed by the image's helper; keep it out of logs.
  dc exec -T convex-backend ./generate_admin_key.sh 2>/dev/null | tail -n 1
}

publish_functions() {
  local key
  key="$(admin_key)"
  [ -n "$key" ] || { echo "could not obtain a local Convex admin key" >&2; exit 1; }
  (
    cd "$root"
    export CONVEX_SELF_HOSTED_URL="$local_convex" CONVEX_SELF_HOSTED_ADMIN_KEY="$key"
    unset CONVEX_DEPLOYMENT CONVEX_DEPLOY_KEY
    # convex/auth.config.ts requires an issuer. Without Clerk, use a reserved
    # placeholder so the deploy succeeds and every token is rejected.
    pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN \
      "${CLERK_JWT_ISSUER_DOMAIN:-https://clerk.invalid}" >/dev/null
    pnpm convex:deploy
  )
}

case "${1:-}" in
  up)
    dc up -d --wait convex-backend convex-dashboard
    publish_functions
    dc up -d --build --wait web
    echo "web:       http://$RCP_BIND:$RCP_WEB_PORT"
    echo "convex:    $RCP_CONVEX_URL"
    echo "dashboard: http://$RCP_BIND:$RCP_DASHBOARD_PORT (admin key: scripts/local-env.sh admin-key)"
    ;;
  deploy) publish_functions ;;
  admin-key) admin_key ;;
  status)
    dc ps
    curl -fsS "http://127.0.0.1:$RCP_WEB_PORT/health" && echo
    curl -fsS "$local_convex/version" && echo
    ;;
  logs) shift; dc logs --no-color "$@" ;;
  down) dc down -v --remove-orphans ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
