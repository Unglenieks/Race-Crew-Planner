# Delivery, review, and release policy

## Pull request gates

GitHub branch protection for `dev`, `preview`, and `main` must require:

- passing CI (the bootstrap integrity check now; format, lint, typecheck, tests, build, and Convex validation once the web foundation lands);
- one approval from a reviewer other than the author;
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

## Reviewer checklist

- Confirm the change is focused and understandable.
- Re-run or inspect required checks.
- Verify auth/authorization is server-side and secrets are absent.
- Verify environment changes are isolated and have a rollback plan.
- Confirm docs and analytics catalog changes where applicable.
- Approve and merge only after all gates pass; the author cannot do either.
