# 0004 — Offline queue boundary

## Status

Accepted for the initial offline-manager surface.

The manager reports only durable IndexedDB entries. Existing mutations are not
advertised as queued because they do not yet have idempotent replay and conflict
contracts. A future replayable operation must add ordered persistence, an
explicit conflict state, and a corresponding queue entry before its UI can say
it is safe offline.
