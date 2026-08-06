# Convex API exposure

## Status

Accepted for the self-hosted Convex runtime rollout.

## Context

The web client creates `ConvexReactClient` from `NEXT_PUBLIC_CONVEX_URL`.
That client runs in visitors' browsers, so it cannot reach a Railway private
network address. The prior topology described the Convex backend as private
only, which conflicts with this required browser-to-API path.

## Decision

Expose the Convex backend's API endpoint on a dedicated public domain. Keep
the dashboard, Postgres, and object storage private. The public Convex API is
authenticated by Clerk JWT verification and application authorization in
Convex; it is not an operator interface.

Use the backend API domain for `CONVEX_CLOUD_ORIGIN` and
`NEXT_PUBLIC_CONVEX_URL`. Route Convex HTTP actions through that same domain
under `/http`. Do not assign a public domain to the dashboard merely for
operator convenience; use Railway's private access/SSH workflow instead.

## Consequences

- The Railway topology and release verification must include the public Convex
  API endpoint.
- A failed JWT or authorization check remains a Convex concern, not a network
  boundary substitute.
- The deployment operator must create the backend domain and set the two
  environment-specific URLs before deploying the web service.
