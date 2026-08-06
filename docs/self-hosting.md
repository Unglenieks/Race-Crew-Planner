# Self-hosting Race Crew Planner

You may self-host Race Crew Planner under the repository's
[AGPL-3.0-only license](../LICENSE). A self-hosted instance is independently
operated: you provide its accounts, infrastructure, secrets, domain, data
protection, backups, user support, and legal notices.

## What this guide does and does not provide

The source is public so you can run a local, private, or hosted copy. It does
not provide access to the official Race Crew Planner Railway workspace, domains,
databases, buckets, Clerk applications, PostHog projects, billing systems, or
support operations. Do not ask maintainers for their production secrets.

For a local development setup, follow the commands in the repository README and
copy the appropriate `.env.example` files to untracked local environment files.
The examples intentionally contain variable names only. Obtain or create your
own values for every service you use.

## Railway deployment

You may use Railway or another platform. On Railway, create a project in a
workspace you control, connect **your fork** (not the upstream project), and
create separate development, preview, and production environments if you need
them. Use your own custom domains, service accounts, storage, Postgres data,
Clerk applications, and PostHog projects.

The committed [Railway topology](railway.md) describes the services the
official deployment uses. It is a blueprint, not an entitlement to the official
deployment. Before applying similar infrastructure to your account, replace
upstream-specific repository settings with your fork and review every planned
resource change. Set secrets in your own Railway environment; never commit
them.

The web client needs a public Convex API URL. Keep the Convex dashboard,
Postgres, storage credentials, and administrative keys private. Use distinct
values per environment and enable backups before accepting production data.

## Operating a public instance

If you make a modified version available for users over a network, AGPL section
13 requires you to offer those users the corresponding source for that modified
version. Your instance must use a distinct name and branding under
[the trademark policy](../TRADEMARKS.md), and must not imply that it is the
official hosted service.

You are responsible for privacy, security, terms, subscriptions, support, and
compliance for your installation. Test upgrades, keep dependencies and runtime
images current, and rehearse database recovery. See [Railway operations](railway.md)
and [Convex upgrades](convex-upgrades.md) for the current architecture-specific
requirements.
