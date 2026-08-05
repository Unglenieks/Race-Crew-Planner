# Race Planner

Race Planner is being established as a TypeScript, Next.js, shadcn/ui, Clerk, PostHog, and self-hosted Convex application.

## Start here

- [Implementation plan](docs/implementation-plan.md) — ordered technical work.
- [Platform and environment plan](docs/platform.md) — Railway, Convex, Clerk, and PostHog boundaries.
- [Parallel agent worktree playbook](docs/agent-worktrees.md) — required workflow for every agent change.
- [Delivery and PR policy](docs/delivery.md) — branch promotion, checks, review, and merging.
- [HTML reference material](docs/html/) — the supplied UX/demo material and project scaffold visual.

## Current bootstrap status

The repository structure and operating rules are in place. The application dependencies and external environment resources are intentionally not provisioned by this bootstrap: they must be created through reviewed PRs using the plans above.

## Local setup (once the foundation PR is merged)

```bash
corepack enable
pnpm install
pnpm --filter @race-planner/web dev
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill only development values. Never commit it.
