# Scheduled Convex work

`convex/crons.ts` is the only place recurring application jobs are registered.
Scheduled handlers must be internal functions: a cron has no Clerk identity, so
it cannot safely reuse a mutation that authorizes a user role. A job receives
only the explicit arguments registered by the cron and must validate the data it
acts on just as any other server function does.

## Development proof and operations

The `record scheduler heartbeat` cron runs every 15 minutes and upserts the
`schedulerHeartbeats` row named `scheduler-primitive`. It is a harmless proving
job, not product behaviour. After a development deployment, inspect that row
in the Convex dashboard and confirm `lastRanAt` advances. The cron registration
and execution history are also visible in the Convex dashboard.

The `expire archived events after retention window` cron runs daily at 03:00
UTC. It invokes the internal `events.expireArchived` handler, which deletes an
event only after its 30-day archive window and removes that event's protected
rows and files. After deploying the integration candidate to development,
inspect the cron registration and one successful execution before treating event
retention as operationally proven. Do not manufacture an expired event in a
shared environment merely to test it; use an isolated non-production fixture or
the Convex execution tools with reviewed test data.

Do not catch and hide scheduled-job failures. Let Convex record the failure in
its logs/execution history; operators investigate there, correct the job or its
configuration, redeploy, and verify that the heartbeat (or the affected job)
runs again. Product slices that depend on scheduling must document their own
failure alerting and recovery behaviour.

## Deferred work

Use `ctx.scheduler.runAfter` or `ctx.scheduler.runAt` only from a mutation or
action, and target an internal function. The originating mutation must store
enough durable state for the deferred handler to be idempotent: retries and
duplicate delivery must never create duplicate product effects.
