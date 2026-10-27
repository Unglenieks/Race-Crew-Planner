# Local environments for agent builds

Agents and developers need a running, testable build of their branch. This page
lists what non-production work uses today, what it costs, and how to get a
running stack on fleet hardware instead of a Railway environment. Production
stays on Railway ([Railway topology](railway.md)).

## Non-production environments and cloud dependencies

| Item | What it is | Cost or dependency | Local replacement |
| --- | --- | --- | --- |
| Railway `development` environment | `web`, `convex-backend`, `convex-dashboard`, Postgres with volume, bucket; deploys `dev` | Paid usage. Postgres and the Convex backend run all the time, so expect very roughly $10–30 a month plus volume and bucket storage (unverified estimate) | Compose stack below; a fleet-hosted `dev` preview |
| Railway `preview` environment | Same services; deploys `preview` for release validation | Same as above | Optional: keep for release validation on Railway's real platform, or replace with a fleet preview |
| `railway run … pnpm convex:codegen` / `convex:deploy` against `development` | Codegen and manual function pushes ([convex](convex.md)) | Needs Railway access and a live development backend | Run against the local backend (below) |
| GitHub Actions | Former CI | GitHub minutes | Replaced by Forgejo Actions on the fleet runner ([delivery](delivery.md#continuous-integration)) |
| Clerk development instance | Sign-in for every non-production build | Free tier; cloud only. Without it the app runs signed-out only | No self-hosted equivalent. One shared development instance serves all local and preview builds |
| PostHog | Analytics | Free tier; optional | Leave unset. The app stays inert without it |
| Google Geocoding API | Server-side address and Plus Code lookup | Paid per request after free credit; optional | Leave unset (lookups fail gracefully), or use a separate, restricted development key |
| Public registries (npm, GHCR Convex images, Docker Hub `node`, Google Fonts) | Downloads | Free | Unchanged |

## The local stack

[`deploy/local/compose.yaml`](../deploy/local/compose.yaml) runs one complete,
isolated environment:

| Service | Image | Host port (default) |
| --- | --- | --- |
| `convex-backend` | `ghcr.io/convex/convex-backend` at the revision pinned in `.railway/railway.ts`, SQLite and local file storage in a named volume (no Postgres or bucket needed) | 3210 (API), 3211 (HTTP actions) |
| `convex-dashboard` | matching `convex-dashboard` | 6791 |
| `web` | built from [`deploy/local/web.Dockerfile`](../deploy/local/web.Dockerfile) (`next build`, `next start`) | 3000 |

Drive it with [`scripts/local-env.sh`](../scripts/local-env.sh) from a clean
checkout after `pnpm install --frozen-lockfile`:

```bash
scripts/local-env.sh up        # start Convex, publish convex/, build and start web
scripts/local-env.sh status    # containers, /health, Convex /version
scripts/local-env.sh deploy    # republish convex/ after changing functions
scripts/local-env.sh down      # delete containers and data
```

`up` generates the local admin key inside the backend and uses it only for
that command, so no key is written to disk or printed. Use
`scripts/local-env.sh admin-key` when signing in to the dashboard.

Code generation against the local backend replaces the Railway command:

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
CONVEX_SELF_HOSTED_ADMIN_KEY="$(scripts/local-env.sh admin-key)" \
pnpm convex:codegen
```

Settings are environment variables (see the script header). Set
`RCP_LOCAL_PROJECT` and the four `RCP_*_PORT` values to run several stacks on
one Docker host, and `RCP_CONVEX_URL` to the address a browser uses to reach
the backend when that is not `127.0.0.1`. The compose file uses no bind mounts,
so it also works against a remote Docker daemon (`DOCKER_HOST=ssh://…`).

### Sign-in

Without Clerk values the web image is built signed-out: it serves its public
pages and `/health`, but has no Convex client, because the app's Convex
provider depends on Clerk. Convex itself still runs and receives the functions,
so backend work (codegen, `convex run`, the dashboard) works without Clerk. For real testing, export the shared Clerk
**development** instance's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY` and `CLERK_JWT_ISSUER_DOMAIN` before `up`. Clerk
development instances accept any origin, so the same instance works for every
local stack and preview URL. Never use production Clerk keys locally.

### CI check

The `Local environment` workflow
([`.forgejo/workflows/local-environment.yml`](../.forgejo/workflows/local-environment.yml))
starts the stack on the fleet runner with per-run ports, checks `/health`, the
home page, Convex `/version` and the dashboard, then deletes it. It runs on PRs
that touch the stack or `convex/`, and by
`fleet-ci dispatch Race-Crew-Planner local-environment.yml <branch>`. It uses
no secrets and deploys nothing.

## Recommendation

1. **Now (this repository, no new infrastructure):** use the compose stack.
   CI proves it starts on every relevant PR. Agents that have Docker run it
   directly; agents on Shipyard, which has no Docker, can only exercise it
   through CI until step 2.
2. **Fleet `agent-builds` VM (needs Daniel):** a Debian VM on Oceanus with
   Docker, built like the CI runner (VM 444) but long-lived, sized for about six
   concurrent stacks (8 vCPU, 16 GiB RAM, 100 GiB disk; one stack uses about
   1 GiB RAM). Agents on Shipyard run
   `DOCKER_HOST=ssh://<agent-builds> scripts/local-env.sh up` with their own
   `RCP_LOCAL_PROJECT` and ports. Keeping builds off Shipyard keeps agent
   workspaces and credentials out of reach of the containers, as with the
   runner.
3. **Per-branch preview URLs (needs Daniel):** on the `agent-builds` VM, run a
   reverse proxy that routes by hostname to each compose project (Caddy or
   Traefik with Docker labels). In front of it, add one wildcard proxy host in
   Nginx Proxy Manager, `*.preview.home.unglenieks.com`, with a matching
   wildcard certificate issued by the existing GoDaddy DNS-01 hook. The
   router's dnsmasq already answers every name under `home.unglenieks.com`
   with NPM, so no per-preview DNS or NPM change is needed. Each preview gets
   `rcp-<branch>.preview.home.unglenieks.com` (web) and
   `rcp-<branch>-convex.preview.home.unglenieks.com` (Convex API, which needs
   WebSockets), reachable from the LAN and tailnet only. A Forgejo workflow on
   same-repository PRs (`opened`, `synchronize`) runs `scripts/local-env.sh up`
   against the VM with the Clerk development values as Actions secrets, posts
   the URL as a PR comment through the Forgejo API, and removes the stack on
   `closed`. A long-lived `rcp-dev` preview follows `dev`.
4. **Then retire Railway `development`.** Keep `production` and, if wanted,
   `preview` for release validation on the real platform.

### Self-hosted PaaS

Coolify and Dokploy would provide a UI, builds and routing, but each adds its
own control plane (database, proxy, updates) to operate, and their pull-request
preview deployments are built around GitHub integrations rather than Forgejo.
For one compose-based app, a Docker host plus a hostname router and a Forgejo
workflow is less to run. Reconsider a PaaS if several fleet projects need
long-lived previews with a UI.

## What stays on paid or external cloud

- Railway `production` (and `preview` if kept): web, Convex, Postgres, bucket.
- Clerk: production instance (paid as usage grows) and the free development
  instance used by local and preview builds.
- PostHog production project; Google Geocoding production key.
- GitHub as a read-only mirror, which Railway currently builds from
  ([deployment trigger](railway.md#deployment-trigger)).
