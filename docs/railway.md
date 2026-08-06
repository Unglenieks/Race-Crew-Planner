# Railway topology and operations

## Managed topology

The committed Railway topology is in [`.railway/railway.ts`](../.railway/railway.ts).
It defines one project with these resources in every environment:

| Resource           | Purpose                                                 | Exposure                               |
| ------------------ | ------------------------------------------------------- | -------------------------------------- |
| `web`              | Next.js application from `Unglenieks/Race-Crew-Planner` | Public domain and `GET /health`        |
| `convex-backend`   | Pinned self-hosted Convex runtime                       | Railway private network only           |
| `convex-dashboard` | Operator dashboard for the matching Convex backend      | Restricted operator access only        |
| `Postgres`         | Convex backing store                                    | Railway private network only           |
| `rcp-files`        | Convex file storage                                     | Credentials are private variables only |

Railway environments are intentionally isolated. Their source branches are
`dev` → `development`, `preview` → `preview`, and `main` → `production`.
Each environment has independent Clerk and PostHog configuration, Convex
credentials, database data, object-store credentials/prefix, and public domain.
No secret value belongs in this repository.

## Applying a reviewed topology change

Run these commands from a clean worktree after the infrastructure PR has been
reviewed. The plan is read-only; applying it is a deliberate, separately
authorized action.

```bash
pnpm install --frozen-lockfile
railway link --project <project-id> --environment <development|preview|production>
railway config plan
railway config apply
```

Review the plan for the selected environment before applying it. In particular,
verify that it does not replace secret variables, delete an existing service,
or re-create Postgres or its volume. Never use `--show-values` in shared logs,
and do not use non-interactive destructive confirmation without explicit human
approval of the exact plan.

The IaC file intentionally does not configure a Convex image. Before a
deployment, a focused Convex-runtime PR must pin a supported backend and
dashboard image version, define their health checks and startup commands, and
document the required private variables. This prevents an unreviewed `latest`
image from becoming the production runtime.

## Environment variable contract

Set these values in the matching Railway environment, never in Git. The web
service receives only the web values; Convex secrets remain on the Convex
services.

| Owner            | Required variables                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web              | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_RELEASE_SHA` |
| Convex backend   | `CLERK_JWT_ISSUER_DOMAIN`, Postgres connection settings, object-storage endpoint/credentials/prefix, Convex deployment and admin secrets                                                   |
| Convex dashboard | Dashboard-to-backend URL and dashboard/operator authentication settings                                                                                                                    |

Set `NEXT_PUBLIC_APP_ENV` to the Railway environment name and
`NEXT_PUBLIC_RELEASE_SHA` to the deployed commit SHA at build time. Use distinct
Clerk applications/keys and distinct PostHog projects (or an equivalent hard
environment boundary) for development, preview, and production.

## Health, backups, and recovery

- The `web` service must pass `GET /health` before Railway treats a deployment
  as healthy. Verify its deployed commit SHA and health endpoint after every
  promotion.
- Keep Convex, Postgres, and bucket access private. Do not add public TCP
  proxies for them.
- Enable and verify daily Postgres volume backups before production traffic.
  Retain backups according to the production data-retention decision and record
  the designated recovery owner.
- Before launch, rehearse a restore into an isolated environment: restore a
  backup, start the matching pinned Convex version, validate a non-sensitive
  query, and record the recovery time and result in the release evidence.
- Roll back an application release by promoting the previously healthy commit
  through the normal `main` ← `preview` ← `dev` lanes. Do not copy environment
  variables or database data between environments as a rollback shortcut.

## Post-apply verification

For each environment, confirm that the expected five resources exist, only
`web` has a public domain, the database has an attached persistent volume and
backups, the bucket has an environment-specific prefix/credentials, and every
service deployment has reached Railway's terminal `SUCCESS` state. Record the
environment, commit SHA, health URL result, and backup/restore evidence in the
deployment handoff.
