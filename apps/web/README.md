# Web application

This workspace contains the Next.js App Router application. It uses strict
TypeScript, Tailwind CSS, local shadcn/ui components, formatting, linting,
tests, and a health route.

Clerk and Convex are connected for authenticated requests. PostHog initializes
only after explicit consent and a configured public key; see
`docs/analytics-events.md` for the permitted event vocabulary.

Do not add production credentials here. `apps/web/.env.example` contains names and explanatory comments only.
