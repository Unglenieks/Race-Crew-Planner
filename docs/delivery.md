# Delivery, review, and release policy

## Pull request gates

GitHub branch protection for `dev`, `preview`, and `main` must require:

- passing CI (the bootstrap integrity check now; format, lint, typecheck, tests, build, and Convex validation once the web foundation lands);
- a pull request (human authorization to merge is an operating rule recorded in the PR, not a GitHub approval requirement);
- resolved review conversations;
- an up-to-date branch; and
- no direct pushes or force pushes.

Use a merge queue or rebase merge policy so the tested commit is the merged commit. Restrict production merges to designated release reviewers.

## Promotion flow

```text
feature/* --PR--> dev --promotion PR--> preview --release PR--> main
                     |                    |                    |
                development           preview              production
                auto-deploy           auto-deploy           auto-deploy
```

A promotion PR contains the exact commits from the previous lane. Do not add feature work directly to `preview` or `main`.

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
