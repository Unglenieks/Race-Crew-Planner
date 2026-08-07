# Product plan — remaining work

## How to read this

`docs/implementation-plan.md` covers work packages 1–7, which are foundation and
delivery concerns and are complete. This document covers the product work that
remains, in the order it should be built.

The scope authority is `docs/html/race-planner-ux-spec.html` (v2.0) and its
28-screen companion prototype. Two things about that spec matter here:

- It is still marked "For review — Not yet approved for build", and it carries
  three unanswered open questions. Slices below that depend on those questions
  say so.
- It defines its own delivery tiers in §13: **Build first**, **Build next**, and
  **Prove before expanding**. Where this plan departs from that ordering, it says
  why.

Every "current state" note below was verified against the code, not inferred
from the spec. Where the spec asks for something and no code exists, that is
stated plainly rather than described as partial.

## Baseline — what exists today

Event context and membership, Clerk identity with Convex-side authorization,
movement plan with sections and publish/acknowledge delivery tracking, work
checklists with templates and item detail, records directory with configurable
types, categories, venue detail and travel context, versioned forms with
structured field validation, activity and comments with text sources, people and
permissions, file evidence, print and CSV export, event archive/restore, and a
bounded browser-backed offline package with queued work completion.

26 Convex tables. 20 workspace routes. 14 registry screens.

## Prerequisites — build these first

These are small, and three separate slices below each need them. Doing them once
avoids three ad-hoc versions.

### P1 · Component test infrastructure

**Current state.** jsdom and React Testing Library are configured and run in
CI. The suite covers representative mutation failure, role-gating, first-run,
file upload, export, responsive navigation, and offline-conflict interactions.
The largest screens still need coverage whenever their workflows change; a
passing infrastructure check is not a substitute for a user-flow test.

**Scope.** Add jsdom and RTL, one example test per interaction pattern already
in the codebase (form submit, mutation error banner, role-gated control), and a
short convention note.

**Not in scope.** Backfilling coverage for every existing component in one
formatting-only sweep. New or changed interactions add their own regression
coverage.

**Exit criteria.** A failing component test blocks CI. **Code complete;** every
subsequent interaction change adds its own coverage.

### P2 · Scheduler primitive

**Current state.** `convex/crons.ts` registers an internal heartbeat and the
daily event-retention expiry job. `docs/scheduling.md` defines the
recurring/deferred work convention. Change escalation (S8) still needs its own
job, but it now shares this reviewed boundary rather than inventing one.

**Scope.** One reviewed pattern for scheduled and deferred Convex work:
where cron definitions live, how a scheduled function proves authorization
without a caller identity, how failures surface, and how it behaves in the
development environment.

**Not in scope.** Any particular scheduled job. This delivers the primitive and
one trivial proving job only.

**Exit criteria.** A scheduled function runs in the development deployment, is
observable, and has a documented failure path. **Code complete; deployment
verification remains required before the slice is operationally complete.**

## Slices, in dependency order

### S1 · Views and fields

**Tier.** Build first. "Configurable collections/fields; table and list views
with required responsive reflow" is named in §13 Build first, which places it
ahead of everything else here.

**Current state.** Event records have configurable text/select fields, table and
list views, responsive reflow, and result-changing filters. This is deliberately
the collection boundary for S1; the product has no generic collection model, so
extending it to unrelated screens needs its own design rather than a misleading
shared abstraction.

**Scope.** Per-collection configurable fields; table and list views with the
required responsive reflow; filters that visibly change results.

**Not in scope.** Saved _shared_ views, and the map, board, and timeline
layouts. The spec deliberately leaves those layouts unspecified (§14) and puts
saved shared views in Build next.

**Prerequisites.** P1.

**Exit criteria.** A team can rename and reorder fields on the event-record
collection, switch between table and list, and every filter control changes the
rows behind it (Guardrail E). **Code complete in the PR chain headed by #52.**

### S2 · First run, empty states, and a removable sample event

**Tier.** Build first.

**Current state.** A new account can either create an event or open a populated,
owner-owned sample event with records, configured fields, a plan item, and work.
The sample can be removed in one action, including all event-local rows.

**Scope.** A populated sample event that demonstrates the product and is
removable in one action, plus the first-run path for a brand-new account.

**Not in scope.** Onboarding tours or tooltips.

**Prerequisites.** P1. Best done after S1, so the sample event can demonstrate
configured fields and views rather than needing rework.

**Exit criteria.** A new account lands somewhere useful, and the sample event can
be removed in one action without leaving orphaned rows. **Code complete in this
PR.**

### S3 · Evidence and field readiness — files and sources library

**Tier.** Build first for navigation presence (§02 lists Files in primary
navigation); the capture surface itself spans Build first and Build next.

**Current state.** The files library uses Convex storage and an `eventFiles`
table. Members can upload an event, record, work-item, or movement attachment;
managers and owners can remove one, and all members can retrieve authorized
files. The UI accepts PDF, image, and text files up to 10 MB and keeps failed
uploads visibly failed.

**Not in scope.** Offline upload, full-text extraction, search across file
contents, and replacing Convex storage with another object-storage authority.
The offline package deliberately excludes signed URLs and files.

**Remaining design decision.** `docs/railway.md` still describes an `rcp-files`
object-storage service. Keep Convex storage authoritative unless a new reviewed
decision demonstrates a need to migrate; do not introduce a second source of
truth by accident.

**Exit criteria.** **Basic library code complete.** Any expansion must preserve
Convex-side authorization and state honestly whether the upload finished.

### S4 · Offline manager

**Current state, and an important distinction.** The status badge is done, and
the Offline manager now stores an event plan/checklist package in IndexedDB.
Work completions survive a reload, replay in order with a server-side idempotency
key, expose last successful sync, and show the operator the current server state
when a replay needs a decision. Storage read/write failures are visible rather
than reported as success.

**Current limitation.** There is no service worker, manifest, or offline page
shell. A saved package is not an installable or launchable offline application;
the browser still needs a connection for a fresh app load. Files and all changes
other than explicit work completion remain online-only.

**Scope next.** Decide whether the product needs a real offline application:
which pages and assets are cached, how a package opens without a network, queue
support beyond work completion, storage exhaustion recovery, and conflict
comparison for each mutation type.

**Not in scope.** Reaching a person with no connection at all. That is spec open
question 01 and is unresolved; it may be a pre-departure briefing checkpoint or
accepted voice fallback.

**Exit criteria.** The implemented queue is safe and truthful. A full offline
experience remains blocked on its own reviewed caching/queuing design.

### S5 · Archive, restore, retention, and permanent deletion

**Tier.** Build next, but it is a prerequisite for honest behaviour in S1 and S3,
so it should not slip far.

**Current state — event lifecycle is implemented; general lifecycle is not.**
An owner can archive an event, restore it during a 30-day window, or permanently
delete it after acknowledging the impact. A daily internal Convex job expires
events after that window. The scheduler still needs development-deployment proof
before this is considered operationally complete. Other archive support remains
per-screen and inconsistent:

| Entity                  | `archivedAt` | Archive                                  | Restore                                  |
| ----------------------- | ------------ | ---------------------------------------- | ---------------------------------------- |
| `events`                | yes          | yes                                      | yes — 30-day retention                  |
| `itineraryItems`        | yes          | yes                                      | yes                                      |
| `eventRecordTypes`      | yes          | yes                                      | yes                                      |
| `eventRecordCategories` | yes          | yes                                      | yes                                      |
| `workTemplates`         | yes          | yes                                      | yes                                      |
| most other tables       | no           | no                                       | no                                       |

**Scope.** Generalize the remaining per-screen archive behaviour: consistent
`archivedAt` semantics, impact disclosures for irreversible actions, and a
clear retention/deletion policy for each primary entity.

**Not in scope.** Inventing per-screen archive behaviour. Existing per-entity
archive paths should be migrated onto the registry, and `mergeCategory`'s
side-effect archive replaced with a standalone one.

**Prerequisites.** P1, P2 for retention expiry. S3 must define what archiving a
record does to its attachments.

**Exit criteria.** Every intended archivable entity uses a documented path; the
event retention job has been observed in development; permanent deletion states
which records, users, and views are affected and is owner-gated.

### S6 · Richer form field types and conditional logic

**Tier.** Build next.

**Current state.** The field union is `text | number | date | select |
multiSelect | boolean`. Submissions correctly snapshot their field schema, so
versioning is already sound — this slice extends types, not the versioning
model.

**Scope.** The remaining spec field types: file and photo, signature, person,
record link, calculated, and repeatable, plus conditional logic.

**Ordering dependency worth noting.** The file and photo field types are blocked
on S3. Person and record link are not, and could ship earlier.

**Not in scope.** Formulas and deep conditional logic beyond what teams are
observed to need — §13 puts those in "Prove before expanding".

**Prerequisites.** P1; S3 for file and photo only.

**Exit criteria.** A new field type round-trips through build, draft, submit, and
a superseded version without altering completed submissions.

### S7 · Export beyond print

**Tier.** Build next.

**Current state.** The plan export screen still supports browser print, and now
also creates a downloadable CSV brief. Each download is an authorized,
event-local snapshot with its generation time, selected-day filter, timezone,
and movement rows. The export history compares each snapshot to the live
filtered plan and explicitly marks a prior brief superseded when the plan has
moved on.

**Scope.** Export with supersede marking, per §05, so a printed or exported plan
that has since changed says so. CSV is the portable first artifact; no PDF,
share link, or offline briefing package is implied.

**Prerequisites.** P1.

**Exit criteria.** An exported artefact carries its generation time and a
supersede marker when the plan has moved on. **Code complete in the PR stacked
on #61.**

### S8 · Escalation for unacknowledged critical changes

**Tier.** Build next.

**Current state.** `planChanges.severity` is stored but purely informational.
Delivery tracking and acknowledgement already work well; only escalation is
missing. No notification channel of any kind exists — no email, push, or SMS.

**Scope.** Escalation when a critical change goes unacknowledged, per §09.

**This slice needs a notification channel decision first.** The existing publish
flow deliberately reports reach rather than send, which is honest and should not
be quietly changed into a send claim. Escalating in-product only is a legitimate
first cut and avoids the dependency.

**Prerequisites.** P2. A notification channel decision if escalation leaves the
product.

**Exit criteria.** An unacknowledged critical change escalates on a real
schedule, and the product never claims to have notified someone it has not.

## Housekeeping

Small, independent, and safe to interleave.

- `records.mergeCategory` is correct but has no UI. Either surface it or remove
  it — an unreachable mutation is dead surface.
- `eventRecords.latitude` and `longitude` are validated and safe but have no UI
  and no writer.
- Reopening a completed work item resets it to `open`, because the previous
  status is not stored. Either store it or accept and document the behaviour.
- Historical PRs #41–#62 are ancestors of the integration candidate and should
  be closed with a pointer to the merged integration PR rather than merged one
  by one.

## Deliberately not planned

- **Automations.** Removed; see `docs/decisions/0002-remove-inert-automation.md`.
  Revisit only when observed team workflows show which triggers are wanted, and
  only after P2 exists.
- **Formulas and deep conditional logic.** §13, "Prove before expanding".
- **Cross-event reporting.** Spec open question 03 asks whether it belongs in
  this product at all. Do not build it until that is answered.
- **Map, board, and timeline layouts.** Named in the spec but deliberately
  undrawn; no layout has been designed.

## Open questions that gate scope

These come from §14 and are unresolved. Each blocks part of a slice above.

1. **Reaching a person with no data connection for hours.** Blocks the outer
   edge of S4 and S8. Is there a required pre-departure briefing checkpoint, or
   is voice contact the accepted fallback, recorded per §09?
2. **Who owns event structure while the owner is driving.** Permissions assume
   the owner is reachable, which during a stage they are not. Affects S5's
   owner-only permanent deletion in particular.
3. **Whether cross-event reporting belongs in this product.** Keeps the item
   above in "not planned" until answered.
