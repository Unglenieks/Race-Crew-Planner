# Platform and environment plan

## Environments and promotion

| Git branch | Railway environment | Purpose | Entry rule |
| --- | --- | --- | --- |
| `dev` | `development` | Continuous integration and developer validation | Feature PR merges after review and checks |
| `preview` | `preview` | Shared release validation | Promotion PR from `dev` only |
| `main` | `production` | Customer-facing release | Promotion PR from `preview` only |

Railway must automatically deploy the matching branch after GitHub checks pass. Each deployment records the commit SHA and has a health check. Never promote by manually copying code or variables between environments.

## Railway services per environment

1. `web`: Next.js container, public domain, health endpoint.
2. `convex`: pinned supported Convex self-hosted runtime topology.
3. `postgres`: private persistent backing database for Convex; production backups and restore procedure required.
4. Object storage: isolated bucket or prefix for Convex file storage, with environment-specific credentials and lifecycle policy.

Each environment has separate data, domain, secrets, Clerk credentials, and PostHog environment tagging. The services must not point across environment boundaries. The source-controlled topology and operational procedure are in [Railway topology and operations](railway.md).

## Identity and analytics

**Clerk** owns authentication and session lifecycle. Activate Clerk's Convex
integration in each Clerk application; it provisions the `convex` JWT template.
Configure that application's Frontend API URL as `CLERK_JWT_ISSUER_DOMAIN` on
the matching Convex service, then deploy `convex/auth.config.ts`. The web app
uses `ConvexProviderWithClerk` to request those tokens. Create application-level
authorization helpers in Convex, and use distinct development and production
Clerk instances/keys.

For event sharing, enable Clerk application invitations in each matching Clerk
instance. The web server creates the email invitation only after Convex confirms
the caller owns the event. On sign-in, Convex activates a matching pending
event invitation only when the Clerk JWT asserts the invitee's verified email.
Phone numbers are retained only as verified owner-visible contact data; this
application does not send SMS invitations.

**PostHog** is analytics only. Initialize it after consent/session readiness, identify with non-sensitive stable IDs, and never send credentials or protected content. Maintain event names and properties in `docs/analytics-events.md`.

The web service receives `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_APP_ENV`, and `NEXT_PUBLIC_RELEASE_SHA` at build time. Use a distinct PostHog project (or an equivalent environment boundary) for development, preview, and production; set `NEXT_PUBLIC_APP_ENV` to the Railway environment name and `NEXT_PUBLIC_RELEASE_SHA` to the deployed Git commit. The key is public by design, but it must be scoped to its matching PostHog project and is never a substitute for consent.

## Secret inventory

| Owner | Examples | Store |
| --- | --- | --- |
| Web | Clerk publishable/secret keys, Convex URL, PostHog key/host | Railway environment variables |
| Convex | Clerk issuer/JWT config, database and object-storage credentials | Railway private variables/service configuration |
| CI | Railway deploy token or GitHub integration credentials | GitHub environment secrets or Railway GitHub integration |

Only variable names belong in Git. Production secret rotation and restore ownership must be recorded before launch.

## Required runbooks before production

- Deploy verification and rollback
- Postgres backup and restore rehearsal
- Convex upgrade procedure
- Clerk key rotation
- PostHog incident/consent handling
