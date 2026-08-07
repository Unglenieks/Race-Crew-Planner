# 0003 — Event evidence uses Convex file storage

## Status

Accepted for the files-and-sources-library slice.

## Decision

Event and record attachments are stored in Convex file storage. `eventFiles`
stores the event-local authorization relationship and non-sensitive display
metadata; it never exposes object-store credentials or a bucket URL.

The initial library accepts PDFs, JPEG/PNG/WebP images, and plain-text files up
to 10 MB. Full-text extraction/search is not part of this slice. A signed
upload URL is issued only after Convex verifies event membership, and listing or
retrieving a file also requires membership in that event.

Attachments are event- or record-scoped. Managers and owners may remove them.
The forthcoming archive/retention slice owns archive and permanent-deletion
semantics; until then, this slice does not claim that archived-parent retention
exists.

## Consequences

The Railway `rcp-files` bucket remains an implementation detail of the
self-hosted Convex runtime, not a second application storage authority. This
keeps authorization in Convex and avoids committing or exposing S3 credentials.
Offline downloads and queued uploads remain explicitly out of scope until S4.
