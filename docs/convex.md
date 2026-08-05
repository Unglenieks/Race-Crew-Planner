# Convex development workflow

Convex is the application data and authorization boundary. Clerk supplies
identity and session lifecycle; application roles, memberships, and
resource-level checks remain in Convex.

## Local setup

1. Copy the root `.env.example` to `.env.local` and obtain development-only
   access from the environment operator. Do not copy production credentials
   into a local file.
2. Ensure the self-hosted Convex development environment is available. Railway
   provisioning is intentionally deferred to Work Package 6.
3. In Clerk, activate the Convex integration. It provisions the `convex` JWT
   template. Copy Clerk's Frontend API URL to `CLERK_JWT_ISSUER_DOMAIN` in the
   matching Convex environment.
4. Run `pnpm convex:dev`. The CLI checks the functions, regenerates
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
- `convex/auth.config.ts` accepts only the Clerk issuer configured by
  `CLERK_JWT_ISSUER_DOMAIN`, with audience `convex`. The web app's
  `ConvexProviderWithClerk` requests that named JWT template for every
  authenticated Convex request.

## Environment variables

Use either `CONVEX_DEPLOYMENT` for an already configured development deployment
or the `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` pair to
target the self-hosted instance directly. `CONVEX_DEPLOY_KEY` is only for
non-interactive cloud deployment automation and belongs in the appropriate
secret store. Set `CLERK_JWT_ISSUER_DOMAIN` on the Convex service to its
matching Clerk Frontend API URL. Set `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` on the web service.
Use separate Clerk applications and Convex URLs per environment.
