# Parallel agent worktree playbook

## Purpose

Parallel agents may work at the same time only through isolated worktrees and focused branches. This prevents one agent from overwriting another's files, dependencies, or Git state.

## Roles

| Role | May do | May not do |
| --- | --- | --- |
| Coordinator | Divide work, assign branch names, monitor dependency order | Edit a contributor's worktree without taking ownership |
| Implementer agent | Make one scoped change, test it, open a PR, provide handoff, and merge after explicit human permission | Infer merge permission or modify shared integration branches directly |
| Reviewer agent | Review a different author's PR, request changes, and report evidence to the human | Grant merge permission on the human's behalf |
| Release reviewer | Review promotion PRs and production evidence | Bypass the promotion lane |

## Setup

The primary checkout is a control plane. Once a remote and `dev` exist, create worktrees beside it, never inside it:

```bash
git fetch origin
mkdir -p ../race-planner-worktrees
git worktree add -b feat/web-foundation ../race-planner-worktrees/web-foundation origin/dev
git worktree add -b docs/analytics-catalog ../race-planner-worktrees/analytics-catalog origin/dev
```

An agent must report its assigned task, base branch, worktree path, and intended files before editing. One task owns a file at a time. If two tasks need the same file, sequence them or extract a shared prerequisite PR first.

## Implementer loop

1. Read `AGENTS.md`, the relevant plan, and the current branch status.
2. Work only in the assigned worktree and branch.
3. Keep commits small and describe intent.
4. Run relevant checks; record exact commands and outcomes.
5. Rebase onto the current base branch before opening the PR if required by policy.
6. Open a PR into `dev` (or the explicitly assigned promotion target) using the template.
7. Hand off the PR URL, verification evidence, known risks, and rollback notes to the human and request explicit merge authorization.
8. After that authorization, add a PR comment recording it, verify all gates, and merge. Remove the worktree only after merge and confirmation.

## Reviewer loop

1. Review the diff and required checks in GitHub, then inspect affected local code if useful.
2. Request changes or provide an evidence-based recommendation to the human.
3. Do not treat another agent's recommendation as merge authorization.
4. After human authorization, verify the PR target and all gates, then the authoring agent may merge.
5. Report the merge SHA and deployed environment; for Railway, verify a terminal successful deployment before declaring success.

## Cleanup

```bash
git worktree remove ../race-planner-worktrees/web-foundation
git branch -d feat/web-foundation
git worktree prune
```

Never delete a worktree with unmerged work. Preserve it or open a draft PR first.

## Conflict and dependency protocol

- Do not resolve another agent's conflict silently.
- The coordinator chooses the integration order and communicates it in the task assignment.
- Rebase after dependent PRs merge; rerun checks; update the PR evidence.
- If a shared decision blocks multiple tasks, create a short decision record under `docs/decisions/` before implementation resumes.
