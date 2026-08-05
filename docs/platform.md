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

Each environment has separate data, domain, secrets, Clerk credentials, and PostHog environment tagging. The services must not point across environment boundaries.

## Identity and analytics

**Clerk** owns authentication and session lifecycle. Activate Clerk's Convex
integration in each Clerk application; it provisions the `convex` JWT template.
Configure that application's Frontend API URL as `CLERK_JWT_ISSUER_DOMAIN` on
the matching Convex service, then deploy `convex/auth.config.ts`. The web app
uses `ConvexProviderWithClerk` to request those tokens. Create application-level
authorization helpers in Convex, and use distinct development and production
Clerk instances/keys.

**PostHog** is analytics only. Initialize it after consent/session readiness, identify with non-sensitive stable IDs, and never send credentials or protected content. Maintain event names and properties in `docs/analytics-events.md`.

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
