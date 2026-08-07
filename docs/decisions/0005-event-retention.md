# 0005 — Event archive retention and permanent deletion

## Status

Accepted for the lifecycle-safety slice.

## Decision

Only an event owner may archive, restore, or permanently delete an event.
Archiving removes the event from normal event selection but leaves all
event-local rows and evidence intact for 30 days. The owner may restore during
that window. A daily internal Convex job permanently deletes expired events;
it also deletes evidence binaries from Convex storage.

Permanent deletion is available only after archiving and is described in the UI
as irreversible. It removes the event, memberships, operational rows, and
attached evidence. Existing movement, record-vocabulary, and work-template
archives remain reversible local lifecycle controls; their migration to a
single broader registry needs their own user-facing restore inventory.

## Consequences

The unresolved question of delegated owner authority remains deliberately
unchanged: no manager receives permanent-delete authority while an owner is
unavailable.
