# Convex development workflow

Convex is the application data and authorization boundary. Clerk will supply
identity and session lifecycle in Work Package 4; application roles,
memberships, and resource-level checks remain in Convex.

## Local setup

1. Copy the root `.env.example` to `.env.local` and obtain development-only
   access from the environment operator. Do not copy production credentials
   into a local file.
2. Ensure the self-hosted Convex development environment is available. Railway
   provisioning is intentionally deferred to Work Package 6.
3. Run `pnpm convex:dev`. The CLI checks the functions, regenerates
   `convex/_generated/`, and syncs them to the selected development deployment.

Use `pnpm convex:codegen` after changing a schema or function when a long-lived
development process is not running. Generated files are committed because
function modules import their typed builders from `convex/_generated/`.

## Conventions

- Add a table only with the product feature that owns it. Validate every field
  with Convex validators and create indexes alongside the query paths that use
  them.
- Use the generated `query`, `mutation`, `action`, and `internal*` builders
  from `./_generated/server`; do not hand-write untyped function wrappers.
- Public functions validate arguments at their boundary. Keep shared logic in
  small modules and use internal functions for server-only orchestration.
- Every protected function calls `requireIdentity` from `convex/auth.ts`, then
  resolves membership and checks authorization in Convex before reading or
  writing data. Client-provided roles are never trusted.
- Add an authorization test in the same PR as each protected function. Cover
  unauthenticated, unauthorized, and authorized callers.

## Environment variables

Use either `CONVEX_DEPLOYMENT` for an already configured development deployment
or the `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` pair to
target the self-hosted instance directly. `CONVEX_DEPLOY_KEY` is only for
non-interactive cloud deployment automation and belongs in the appropriate
secret store. The browser-facing Convex URL and Clerk configuration are added
with the Clerk integration; they are not needed by this boundary package.
