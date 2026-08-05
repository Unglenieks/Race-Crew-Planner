# Implementation plan

## Outcome

Ship one TypeScript web application using Next.js App Router, Tailwind CSS, shadcn/ui, Clerk, PostHog, and self-hosted Convex. Prefer a straightforward T3-style codebase: strict types, small modules, server-first defaults, Zod validation at boundaries, and repository-owned UI components.

## Work packages

| Order | PR-sized package | Done when |
| --- | --- | --- |
| 1 | Web foundation | `apps/web` runs with Next.js, strict TypeScript, Tailwind, linting, formatting, tests, and a health route. |
| 2 | Design system | shadcn/ui is initialized locally; tokens, theme, and base layout are documented. |
| 3 | Convex boundary | `convex/` has schema conventions, typed functions, auth helpers, and a local developer workflow. |
| 4 | Clerk integration | Sign-in/session flow works; Clerk JWT verification reaches Convex; authorization tests cover protected functions. |
| 5 | Analytics | PostHog initialization, consent policy, release/environment tagging, and a minimal event catalog are present. |
| 6 | Railway topology | Reviewed infrastructure configuration exists for web, Convex, Postgres, storage, health checks, and backups in each environment. |
| 7 | Delivery automation | GitHub checks, protected branches, Railway deployment mappings, promotion PRs, and a rollback runbook are tested. |

## Code boundaries

```text
apps/web/app/          routes, layouts, server components
apps/web/components/   feature and repository-owned shadcn components
apps/web/lib/          env parsing, Clerk/PostHog/Convex clients, utilities
convex/                schema, queries, mutations, actions, authorization
docs/                  plans, runbooks, decisions, event catalog
infra/railway/         versioned Railway configuration and deployment notes
```

## Definition of ready for any implementation PR

- The work package has an owner and a short acceptance statement.
- Environment variables are named in an `.env.example` file without values.
- Expected tests and deployment impact are stated before coding.
- The branch is created from the current integration branch in an isolated worktree.

## Definition of done

- Typecheck, lint, tests, formatting, and production build pass.
- New authentication/data paths have authorization coverage.
- Analytics events are added to `docs/analytics-events.md` in the same PR.
- Infrastructure or environment changes update `docs/platform.md` and the relevant runbook.
- A human explicitly authorizes the merge after reviewing the PR handoff; the authoring agent may then merge it once GitHub checks are green.
