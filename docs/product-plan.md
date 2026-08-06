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
permissions, print export, and an online/offline status badge.

21 Convex tables. 18 workspace routes. 13 registry screens.

## Prerequisites — build these first

These are small, and three separate slices below each need them. Doing them once
avoids three ad-hoc versions.

### P1 · Component test infrastructure

**Why first.** There is no jsdom or React Testing Library setup, so none of the
~3,000 lines of workspace React has a component test. The three worst defects
found reviewing the integration branch were all component-level and none were
reachable by the current suite: a form handler that reported failure after a
successful write, a builder that could publish one template's schema onto
another, and a success banner used for error messages.

**Scope.** Add jsdom and RTL, one example test per interaction pattern already
in the codebase (form submit, mutation error banner, role-gated control), and a
short convention note.

**Not in scope.** Backfilling coverage for every existing component. Establish
the harness; backfill arrives with each slice below.

**Exit criteria.** A failing component test blocks CI. Every slice below adds
component tests for its own screens.

### P2 · Scheduler primitive

**Current state.** `convex/crons.ts` registers an internal heartbeat proving job
and `docs/scheduling.md` defines the recurring/deferred work convention.
Retention expiry (S5) and change escalation (S8) still need their own jobs, but
they now share this reviewed boundary rather than inventing one.

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

**Current state.** No route, no component, no table. The spec's "Views & fields"
prototype screen has no counterpart in code.

**Scope.** Per-collection configurable fields; table and list views with the
required responsive reflow; filters that visibly change results.

**Not in scope.** Saved _shared_ views, and the map, board, and timeline
layouts. The spec deliberately leaves those layouts unspecified (§14) and puts
saved shared views in Build next.

**Prerequisites.** P1.

**Exit criteria.** A team can rename and reorder fields on a collection, switch
between table and list, and every filter control changes the rows behind it
(Guardrail E).

### S2 · First run, empty states, and a removable sample event

**Tier.** Build first.

**Current state.** No seed or sample-data code exists anywhere. Individual empty
states exist on most screens already and are good; the first-run path does not.

**Scope.** A populated sample event that demonstrates the product and is
removable in one action, plus the first-run path for a brand-new account.

**Not in scope.** Onboarding tours or tooltips.

**Prerequisites.** P1. Best done after S1, so the sample event can demonstrate
configured fields and views rather than needing rework.

**Exit criteria.** A new account lands somewhere useful, and the sample event can
be removed in one action without leaving orphaned rows.

### S3 · Evidence and field readiness — files and sources library

**Tier.** Build first for navigation presence (§02 lists Files in primary
navigation); the capture surface itself spans Build first and Build next.

**Current state.** Convex file storage is not used at all: no `ctx.storage`, no
upload path, no attachment table, no file input. The only related feature is
`eventSources`, which stores a title, an optional URL, and a text excerpt.

**This slice needs a reviewed storage design before implementation.** It must not
imply that uploads or offline writes are safe until queuing and conflict
handling exist (see S4). Specifically, the design has to settle: where binaries
live and whether Convex file storage or the already-documented object storage is
authoritative; size and type limits; who may read an attachment, given that
authorization is a Convex concern; what happens to attachments when their parent
record is archived (S5); and whether file text is searchable, since §02 says
search covers file text.

Note that infrastructure for this is already _documented but unused_:
`docs/railway.md` provisions an `rcp-files` service and defines
`S3_STORAGE_FILES_BUCKET` and siblings. The design should reconcile with what is
already described rather than start clean.

**Scope after that design lands.** Attach files and photos to events and
records, alongside the existing link and excerpt sources; a library view; and
capture states that tell the truth about whether an upload has completed.

**Not in scope.** Offline capture and queued upload. That is S4, and until it
exists the UI must not suggest a capture will survive a lost connection. The
spec is explicit that "evidence is usually captured once, in conditions that
cannot be recreated", which is exactly why an honest failure state matters more
than an optimistic one.

**Prerequisites.** P1, and its own storage design decision recorded under
`docs/decisions/`.

**Exit criteria.** A file can be attached, listed, and retrieved with
authorization enforced in Convex; a failed upload is reported as failed and
never as stored.

### S4 · Offline manager

**Tier.** Build first for _offline status_, which already exists. The manager
itself is the unbuilt part.

**Current state, and an important distinction.** The status badge is done
(`apps/web/components/connection-status.tsx`). Nothing else from §11 exists: no
service worker, no manifest, no `apps/web/public/`, no IndexedDB, no queued
change store, no conflict comparison, no last-sync time, no package size.

**There is a deliberate tripwire here.** `apps/web/lib/connectivity.ts`
currently tells the user that changes "cannot be saved or queued", and
`connectivity.test.ts` locks that promise in with a test named "does not
describe an unavailable connection as queued or synchronized". Any queueing work
must consciously retire that test. Do not weaken the message before the
behaviour is real — Guardrail F requires "offline ready" to reflect verified
state.

**This slice needs a reviewed caching and queuing design before
implementation**, covering: what is downloaded and how a package is scoped;
where queued writes are stored and how they survive a reload; how conflicts are
detected and presented, given that the spec requires showing "Record changed or
archived by someone else"; ordering guarantees for a replayed queue against
Convex mutations; and how storage exhaustion is reported.

**Scope after that design lands.** Offline manager screen, download packages,
queued change count and inspection, conflict resolution, and last successful
sync — all surfaced in the shell on every screen size as §02 requires.

**Not in scope.** Reaching a person with no connection at all. That is spec open
question 01 and is unresolved; it may be a pre-departure briefing checkpoint or
accepted voice fallback.

**Prerequisites.** P1, its own caching/queuing design decision, and S3 if
offline evidence capture is in the first cut.

**Exit criteria.** A queued change survives a reload, replays in order, and a
conflict is shown with both versions. The shell reports real queue depth and a
real last-sync time.

### S5 · Archive, restore, retention, and permanent deletion

**Tier.** Build next, but it is a prerequisite for honest behaviour in S1 and S3,
so it should not slip far.

**Current state — this is less generalization and more first-time build.**
Archive support today is per-screen and inconsistent:

| Entity                  | `archivedAt` | Archive                                  | Restore                                  |
| ----------------------- | ------------ | ---------------------------------------- | ---------------------------------------- |
| `itineraryItems`        | yes          | yes                                      | **yes — the only restore in the system** |
| `eventRecordTypes`      | yes          | yes                                      | no                                       |
| `eventRecordCategories` | yes          | only as a side effect of `mergeCategory` | no                                       |
| `workTemplates`         | yes          | yes                                      | no                                       |
| the other 17 tables     | no           | no                                       | no                                       |

Also: `events` has no `archivedAt` at all, though the spec requires archiving an
event with a 30-day restore window. The word "retention" appears zero times in
`convex/` or `apps/web/` — the retention window is currently fiction. And there
is no permanent-delete mutation for any primary entity; the only two
`ctx.db.delete` calls in the codebase act on a membership row and a join row.

**Scope.** A generalized archive registry that the other slices consume rather
than reimplementing per screen: consistent `archivedAt` semantics, restore for
everything archivable, a real retention window with scheduled expiry, impact
disclosures for irreversible actions as Guardrail A requires, and owner-only
permanent deletion.

**Not in scope.** Inventing per-screen archive behaviour. Existing per-entity
archive paths should be migrated onto the registry, and `mergeCategory`'s
side-effect archive replaced with a standalone one.

**Prerequisites.** P1, P2 for retention expiry. S3 must define what archiving a
record does to its attachments.

**Exit criteria.** Every archivable entity archives and restores through one
path; the retention window is enforced by a scheduled job rather than described
in copy; permanent deletion states which records, users, and views are affected
and is owner-gated.

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

**Current state.** `apps/web/components/plan-export.tsx` calls
`window.print()`. There is no PDF, spreadsheet, share link, or offline brief
generation anywhere.

**Scope.** Export with supersede marking, per §05, so a printed or exported plan
that has since changed says so.

**Prerequisites.** P1.

**Exit criteria.** An exported artefact carries its generation time and a
supersede marker when the plan has moved on.

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

- `pnpm format:check` covers only `apps/web`; `convex/` and `tests/` have no
  formatting gate.
- `records.mergeCategory` is correct but has no UI. Either surface it or remove
  it — an unreachable mutation is dead surface.
- `eventRecords.latitude` and `longitude` are validated and safe but have no UI
  and no writer.
- `apps/web/README.md` still says PostHog is deferred; analytics is wired.
- Reopening a completed work item resets it to `open`, because the previous
  status is not stored. Either store it or accept and document the behaviour.
- Integration branch PRs #41–#47 are all ancestors of the integration branch and
  should be closed with a pointer to it. #45 targets #43's branch.

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
