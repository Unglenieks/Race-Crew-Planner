# Official hosted service boundary

The official Race Crew Planner hosted service is a paid, managed offering. Its
annual subscription covers the service operation, including the official
infrastructure, domains, maintenance, backups, updates, and support. The
software in this repository remains available under AGPL-3.0-only for
self-hosting.

The official hosted service is owned and operated independently from public
forks. Its Railway workspace, production data, service credentials, custom
domains, billing accounts, and external-service accounts are private and are
not conveyed by the repository license.

## Required deployment ownership controls

Before accepting customers, the service operator must:

- keep production in a Railway workspace controlled by the operator, with
  least-privilege membership, MFA, recovery contacts, and periodic access
  review;
- connect Railway only to the canonical GitHub repository and protected release
  branches; untrusted pull requests and forks must not receive production
  deployment credentials or trigger deployments to shared environments;
- use separate development, preview, and production services, data stores,
  storage, Clerk applications, PostHog projects, domains, and credentials;
- store private values only in Railway or GitHub environment secret stores,
  never in the repository, build output, pull-request logs, or fork-accessible
  workflows;
- keep administrative services, Postgres, and object storage private, expose
  only the required web and API endpoints, and rotate credentials after a
  suspected compromise; and
- retain backup, restore, incident, and rollback evidence for the production
  service.

The source-controlled Railway topology is intentionally inspectable so a
self-hoster can adapt it to their own account. It does not grant access to the
operator's Railway project or configure a fork to deploy there.

Before public launch, publish and link the following from the official service:

- Terms of Service, including subscription, renewal, cancellation, and refund
  terms;
- Privacy Notice and data-processing disclosures;
- support and service-level policy; and
- service status and incident communications.

Those service terms govern use of the hosted offering. They do not add
restrictions to the AGPL rights for the repository software.
