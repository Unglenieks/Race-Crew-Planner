# Race Crew Planner

Race Crew Planner is software for planning and coordinating race crews. It is
being established as a TypeScript, Next.js, shadcn/ui, Clerk, PostHog, and
self-hosted Convex application.

## Hosted service and self-hosting

The official Race Crew Planner hosted service is a paid annual subscription.
The subscription pays for the managed service: hosting, operations, backups,
updates, support, and the official product experience. It does not limit your
right to run your own copy of the software.

This repository is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(AGPL-3.0-only). You may inspect, modify, and self-host it under that license.
Copyright and third-party notice information is in [NOTICE](NOTICE).
If you need to offer a modified version as a proprietary network service, see
[commercial licensing](COMMERCIAL-LICENSE.md). The license does not grant any
right to use the Race Crew Planner name, logo, official domains, or imply
endorsement; read the [trademark policy](TRADEMARKS.md).

- Want the managed service? Use the official Race Crew Planner site and its
  published service terms.
- Want to operate your own instance? Start with the [self-hosting guide](docs/self-hosting.md).
- Want to contribute? Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

The official hosted service and independently operated installations are
separate systems. An installation made from a fork has its own infrastructure,
domains, accounts, data, and operational responsibility.

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
