# Agent contribution contract

These instructions apply to every automated or human contributor.

## Non-negotiable rules

1. Work in an isolated Git worktree and feature branch; never edit the shared checkout while another task is active.
2. Every change, including documentation and infrastructure, is delivered in a pull request. Do not push directly to `dev`, `preview`, or `main`.
3. An author may not approve or merge their own PR. A different authorized reviewer agent or human must review, approve, and merge.
4. Keep PRs focused. Do not mix product work, dependency upgrades, infrastructure changes, and broad formatting in one PR.
5. Never print, commit, or copy secrets. Use `.env.example` for variable names only and Railway/GitHub secret stores for values.
6. State the commands run and their results in the PR description. If a check cannot run, say why.

## Required workflow

Follow [docs/agent-worktrees.md](docs/agent-worktrees.md) before editing. Use branch names such as `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>`.

Before opening a PR, run the checks applicable to the change. At minimum, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` once those commands exist.

Use the PR template. The handoff must include the PR URL, scope, verification evidence, risk/rollback notes, and any actions the reviewer must take.

## Architecture guardrails

- Keep application authorization in Convex functions, not only in UI components.
- Clerk owns identity/session lifecycle; application roles and data belong in Convex.
- Use local shadcn/ui components and Tailwind tokens; do not introduce an unrelated component system.
- Use PostHog only through the documented event vocabulary and never attach sensitive content.
- Treat Convex, Railway, Clerk, and PostHog configuration changes as reviewed infrastructure work.
