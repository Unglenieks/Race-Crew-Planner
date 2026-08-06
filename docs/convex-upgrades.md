# Convex self-hosted upgrade and recovery runbook

## Scope

This runbook applies to the pinned `convex-backend` and `convex-dashboard`
images in `.railway/railway.ts`. The two images must always use the same Convex
release-branch commit revision.

## Before an upgrade

1. Select the supported revision from Convex's `release` branch and verify that
   both GHCR image tags exist.
2. Open a focused infrastructure PR that changes both image revisions and this
   runbook when behavior changes. Do not use `latest`.
3. Confirm a current Postgres backup and perform a `npx convex export` from the
   development environment. Keep the export in the approved private recovery
   location.
4. Apply the reviewed topology to development, verify `/version`, deploy the
   matching Convex functions, and inspect backend logs until migrations report
   completion.
5. Promote the reviewed change through preview before production.

## In-place upgrade

1. Pause writes if the release owner judges migration risk to be material.
2. Apply the reviewed image revision and wait for the backend's terminal
   Railway `SUCCESS` status.
3. Watch backend logs for each migration completion record (for example,
   `MigrationComplete(...)`).
4. Verify a non-sensitive authenticated query, HTTP-action routing, and the
   web service health endpoint.

## Recovery

If an in-place migration fails, stop external traffic, restore the approved
export into a fresh compatible Convex deployment with
`npx convex import --replace-all`, restore the saved Convex environment
variables, and validate a non-sensitive query before reopening traffic. For a
database-level failure, follow the Railway Postgres restore procedure in an
isolated environment first; never copy production data into another live lane.

## Evidence to record

Record the image revision, Railway deployment IDs and terminal statuses,
`/version` result, migration log evidence, export/restore result, and the
release owner's approval in the release handoff.
