# Race Crew Planner

Race Crew Planner is a TypeScript application for planning and coordinating race
crews. It uses Next.js, local shadcn/ui components, Clerk, consented PostHog,
and self-hosted Convex.

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
- [Product plan](docs/product-plan.md) — remaining product work in dependency order.
- [Platform and environment plan](docs/platform.md) — Railway, Convex, Clerk, and PostHog boundaries.
- [Parallel agent worktree playbook](docs/agent-worktrees.md) — required workflow for every agent change.
- [Delivery and PR policy](docs/delivery.md) — branch promotion, checks, review, and merging.
- [HTML reference material](docs/html/) — the supplied UX/demo material and project scaffold visual.

## Current application status

The workspace includes event membership and roles, movement planning and change
acknowledgements, work checklists, records and venues, versioned forms, file
evidence, a sample first-run event, archive/restore for events, and printable
or CSV plan briefs. The offline package deliberately supports only explicitly
queued work-completion changes; it does not make a fresh browser load available
without a connection.

Read the [product plan](docs/product-plan.md) for the verified capability list,
current limitations, and the remaining delivery order. Environment provisioning
and production readiness still follow the reviewed runbooks in `docs/`.

## Local setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @race-planner/web dev
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill only development values. Never commit it.
