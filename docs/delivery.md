# Delivery, review, and release policy

## Pull request gates

GitHub branch protection for `dev`, `preview`, and `main` must require:

- the `Bootstrap integrity` GitHub check, which runs repository integrity,
  formatting, linting, web and Convex typechecks, tests, and a production build;
- a pull request (human authorization to merge is an operating rule recorded in the PR, not a GitHub approval requirement);
- resolved review conversations;
- an up-to-date branch; and
- no direct pushes or force pushes.

Use a merge queue or rebase merge policy so the tested commit is the merged commit. Restrict production merges to designated release reviewers.

Apply those settings in GitHub after this PR has merged. Confirm the required
check name against a completed workflow run before saving the ruleset; a stale
or misspelled required check can permanently block a branch. GitHub branch
protection is live repository configuration and is not changed by this PR.

## CI and Convex validation

CI intentionally validates Convex functions with `pnpm convex:typecheck`. This
is deterministic and does not require production credentials. `pnpm
convex:codegen` remains a local/deployment setup command because Convex requires
a configured `CONVEX_DEPLOYMENT` to generate the API artifacts. Once the
development Convex deployment exists, run code generation after changing
functions or schema and commit the resulting `convex/_generated/` changes in
the owning feature PR.

## Promotion flow

```text
feature/* --PR--> dev --promotion PR--> preview --release PR--> main
                     |                    |                    |
                development           preview              production
                auto-deploy           auto-deploy           auto-deploy
```

A promotion PR contains the exact commits from the previous lane. Do not add feature work directly to `preview` or `main`.

### Promotion checklist

1. Open a PR from `dev` to `preview`, then from `preview` to `main`; do not
   create a release by copying commits or variables between environments.
2. Verify `Bootstrap integrity` passes on the promotion PR and that the source
   branch is up to date with its target.
3. Obtain explicit human merge authorization and record it in a PR comment.
4. After the merge, verify Railway deployed the matching commit to the mapped
   environment (`development`, `preview`, or `production`), reached terminal
   `SUCCESS`, and that the public web service returns `200` from `/health`.
5. Record the environment, commit SHA, deployment URL/status, health result,
   and any backup/restore evidence in the release handoff.

The source-controlled Railway topology maps `dev` to `development`, `preview`
to `preview`, and `main` to `production`. Apply and verify that topology only
through the reviewed Railway procedure in [Railway topology and
operations](railway.md); this repository cannot safely infer a project or
environment to modify.

## Rollback procedure

Roll back a release by opening a focused revert PR against the affected lane,
then promote that reviewed revert through the normal lanes. Do not roll back by
copying database data, secrets, or environment variables between Railway
environments.

Before approving the revert, identify the last known healthy commit and verify
its migration/data compatibility. After each merge, repeat the promotion
checklist, including terminal Railway `SUCCESS` and `GET /health`. If the issue
involves data or the Convex runtime, pause the rollback and use the applicable
backup/restore or runtime runbook instead of redeploying blindly.

## PR template requirements

Every PR states:

1. What changed and why.
2. Scope intentionally excluded.
3. Commands/tests run and results.
4. Authentication, data, analytics, or infrastructure effect.
5. Risk, rollback, and required post-merge verification.

## Human authorization and merge checklist

Before authorizing an agent to merge, the human should confirm the change is focused, the reported checks are credible, and the stated risk is acceptable. The human can ask another agent to review, but a separate GitHub account is not required.

After an explicit human message such as “merge PR #123,” the authoring agent must add a PR comment citing that authorization, verify all GitHub gates are green, then merge. Without that direct authorization, the PR remains open.
