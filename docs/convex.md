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
   matching Convex environment. Verify the template issues `aud: convex`; a
   template created by hand with empty claims omits `aud`, and
   `convex/auth.config.ts` rejects the token, which surfaces as
   `Unauthenticated` on every protected function.
4. Configure the Clerk `convex` JWT template to include the verified standard
   claims `email`, `email_verified`, `name`, `phone_number`, and
   `phone_number_verified`. Enable phone-number management and verification in
   Clerk's account profile for every Clerk environment. Event invitations match
   only a verified email; verified phone numbers are optional owner-visible
   contact data. Do not add private Clerk metadata to this token.
5. For each environment, manually add and verify a phone through the Clerk
   account menu, refresh the session, and confirm the intended owner can see
   it in the event roster. Then remove it and confirm it no longer appears.
   Do not log phone values while performing this check. Social-login providers
   may omit phone data; accept it only when Clerk exposes it as verified.
6. Run `pnpm convex:dev`. The CLI checks the functions, regenerates
   `convex/_generated/`, and syncs them to the selected development deployment.

Use `pnpm convex:codegen` after changing a schema or function when a long-lived
development process is not running. Generated files are committed because
function modules import their typed builders from `convex/_generated/`.

Code generation does not publish anything. Deployed environments publish
`convex/` through `pnpm convex:deploy`, which the `web` build runs before it
compiles the application; see [delivery](delivery.md). To publish to the
development backend by hand from a clean worktree:

```bash
railway run --environment development --service convex-backend -- pnpm convex:deploy
```

For the Railway self-hosted development deployment, run code generation through
the backend service so the CLI receives the private deployment URL and admin
key from Railway without copying either into a local environment file:

```bash
railway run --environment development --service convex-backend -- pnpm convex:codegen
```

Run this command from the relevant clean worktree. It may update generated
files; commit those changes with the schema or function change that caused
them. Do not run the command against preview or production for routine
development code generation.

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

For Railway's development `convex-backend` service, define
`CONVEX_SELF_HOSTED_URL` as a Railway variable reference to
`CONVEX_CLOUD_ORIGIN`; keep `CONVEX_SELF_HOSTED_ADMIN_KEY` in the Railway
secret store. This is the self-hosted equivalent of configuring
`CONVEX_DEPLOYMENT` and enables the Railway-run codegen command above. Never
copy the admin key into `.env.local`, source control, CI logs, or a PR.
