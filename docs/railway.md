# Railway topology and operations

## Managed topology

The committed Railway topology is in [`.railway/railway.ts`](../.railway/railway.ts).
It defines one project with these resources in every environment:

| Resource           | Purpose                                                 | Exposure                               |
| ------------------ | ------------------------------------------------------- | -------------------------------------- |
| `web`              | Next.js application from `Unglenieks/Race-Crew-Planner` | Public domain and `GET /health`        |
| `convex-backend`   | Pinned self-hosted Convex runtime                       | Public API domain; private data plane  |
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

The topology declares every existing service variable with `preserve()`. This
keeps secret and environment-owned values in Railway when the reviewed topology
is applied; it never copies their values into source control. A plan that
proposes deleting any existing variable is unsafe and must not be applied.

The IaC file pins matching Convex backend and dashboard image revisions. Update
them only through the Convex upgrade runbook; never replace a pinned revision
with `latest`.

## Environment variable contract

Set these values in the matching Railway environment, never in Git. The web
service receives only the web values; Convex secrets remain on the Convex
services.

| Owner            | Required variables                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web              | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_RELEASE_SHA` |
| Convex backend   | `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `CONVEX_SELF_HOSTED_URL` (a reference to `CONVEX_CLOUD_ORIGIN`), `CONVEX_SELF_HOSTED_ADMIN_KEY`, `POSTGRES_URL`, `INSTANCE_SECRET`, `CLERK_JWT_ISSUER_DOMAIN`, object-storage endpoint/credentials/bucket names, Convex deployment/admin secrets |
| Convex dashboard | `NEXT_PUBLIC_DEPLOYMENT_URL`, dashboard/operator authentication settings                                                                                                                   |

Set `NEXT_PUBLIC_APP_ENV` to the Railway environment name and
`NEXT_PUBLIC_RELEASE_SHA` to the deployed commit SHA at build time. Use distinct
Clerk applications/keys and distinct PostHog projects (or an equivalent hard
environment boundary) for development, preview, and production.

### Convex runtime configuration

For each environment, set the backend's `CONVEX_CLOUD_ORIGIN` to its public
Convex API domain and `CONVEX_SITE_ORIGIN` to the matching HTTP-actions origin.
Set the web service's `NEXT_PUBLIC_CONVEX_URL` to the API domain. The API must
be public because the browser-side Convex client connects directly; the
dashboard, Postgres, and bucket remain private. See
[decision 0001](decisions/0001-convex-api-exposure.md).

Generate a distinct `INSTANCE_SECRET` and dashboard admin key per environment
in the secret store. Configure `POSTGRES_URL` with the private Railway Postgres
connection string **without** the database name; Convex derives its database
name from `INSTANCE_NAME` (or `convex_self_hosted` by default). Create that
database before its first backend deployment. For S3-compatible Railway bucket
storage, set the AWS-compatible endpoint, credentials, region, and all five
Convex bucket variables: `S3_STORAGE_EXPORTS_BUCKET`,
`S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET`, `S3_STORAGE_MODULES_BUCKET`,
`S3_STORAGE_FILES_BUCKET`, and `S3_STORAGE_SEARCH_BUCKET`.

Set `NEXT_PUBLIC_DEPLOYMENT_URL` on the private dashboard to the matching
backend API URL. Do not commit any of these values or expose the dashboard.

For development code generation, run `railway run --environment development
--service convex-backend -- pnpm convex:codegen` from the relevant clean
worktree. The command consumes the backend's self-hosted CLI configuration
inside Railway and keeps the admin key out of local configuration.

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

See [Convex self-hosted upgrades](convex-upgrades.md) for the runtime-specific
backup, upgrade, and recovery procedure.

## Repairing a missing GitHub auto-deploy trigger

The `web` service in `development` must be connected to
`Unglenieks/Race-Crew-Planner` branch `dev`. If a merge reaches `dev` but no
Railway deployment is created for its commit, first inspect the source and
recent deployment commits:

```bash
railway service list --environment development --json
railway deployment list --environment development --service web --limit 10 --json
```

If the source/branch is correct but the new commit has no queued deployment,
reconnect the source from a clean worktree only after reviewing a safe IaC plan
and receiving explicit authorization for this live infrastructure change:

```bash
railway service source connect \
  --repo Unglenieks/Race-Crew-Planner \
  --branch dev \
  --service web \
  --environment development
```

The reconnect restores Railway's GitHub deployment trigger; it is not a
substitute for a code deployment. Confirm a newly queued deployment references
the expected commit, reaches `SUCCESS`, and returns `200` from `/health`.

## Post-apply verification

For each environment, confirm that the expected five resources exist, only
`web` has a public domain, the database has an attached persistent volume and
backups, the bucket has an environment-specific prefix/credentials, and every
service deployment has reached Railway's terminal `SUCCESS` state. Record the
environment, commit SHA, health URL result, and backup/restore evidence in the
deployment handoff.
