# Remove the inert automation surface

## Status

Accepted. Supersedes the automation setup screen introduced during the
outage-blocked integration work.

## Context

The workspace shipped an "Automation setup" screen, a `workAutomationRules`
table, and three Convex functions (`list`, `create`, `setEnabled`). No
evaluation existed. The trigger literals `planChangePublished` and
`workCompleted` appeared nowhere outside the schema definition, there was no
scheduler (`convex/crons.ts` and `convex/http.ts` did not exist, and
`ctx.scheduler` was never called), and no notification channel of any kind was
present in the repository.

The screen was honest about this: it carried a "Configuration only" badge and
seven separate disclaimers. But the control still acted. It wrote a row,
reported success, and labelled the result "Enabled" — a state the product could
not deliver.

Three things made keeping it the wrong call.

1. It contradicts Guardrail E in `docs/html/race-planner-ux-spec.html`: "No
   control that does nothing. Every visible control either acts, explains why it
   cannot act, or is not shown. A control that is present but inert is a defect,
   not an unfinished feature." It also strains Guardrail F, which requires
   statuses to reflect verified state.
2. It inverts the spec's own delivery priority. Automations sit in the lowest
   tier, "Prove before expanding", which states they "should follow observed
   team workflows, not assumed complexity". The screen was built before
   Build-first items such as configurable views and fields, first-run and empty
   states, and the offline manager exist.
3. Half of it could not be built honestly yet. The `notifyAssignee` action needs
   a notification channel, and there is none. Even the existing publish flow
   deliberately reports reach rather than send.

## Decision

Remove the automation surface entirely: the screen, its route, its component,
the `workAutomationRules` table, the `convex/workAutomation.ts` module, the
`workAutomationApi` client and `WorkAutomationRule` type, the screen registry
entry, and the associated tests.

Do not reintroduce automation until two conditions hold:

- Observed team workflows show which triggers and actions are actually wanted,
  as the "Prove before expanding" tier requires.
- The shared scheduler primitive exists, since retention expiry and change
  escalation need it independently. See `docs/product-plan.md`.

Nothing is migrated. No environment held automation rules, so no data is lost.

## Consequences

- The Work navigation group is now Work and Checklist templates.
- Convex has 21 tables rather than 22. No migration is required: the table was
  introduced on an unmerged integration branch and never reached a deployed
  environment, so no environment has ever held a `workAutomationRules` document.
- Reintroducing automation means a new table and a new schema review. That is
  the intended cost; it forces the feature to be justified by observed use.
- Guardrail E now holds across the workspace: no shipped control is inert.
