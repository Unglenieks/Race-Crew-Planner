import {
  bucket,
  defineRailway,
  github,
  image,
  postgres,
  project,
  service,
} from "railway/iac";

/**
 * Convex publishes compatible backend and dashboard images under the same
 * release-branch commit. Update both together through the upgrade runbook.
 */
const convexImageRevision = "075bad9adce93eb2f63fffad76db5cb27e9e35bd";

/**
 * Railway project topology. The CLI evaluates this once for each target
 * environment, so each deployment lane follows its matching Git branch.
 *
 * Secrets, external service URLs, and Convex image/version selection stay out
 * of source control; see docs/railway.md for the reviewed apply procedure.
 */
export default defineRailway((ctx) => {
  const branch = ctx.isEnvironment("development")
    ? "dev"
    : ctx.isEnvironment("preview")
      ? "preview"
      : "main";

  const web = service("web", {
    source: github("Unglenieks/Race-Crew-Planner", { branch }),
    build: "pnpm build",
    start: "pnpm --filter @race-planner/web start",
    healthcheck: "/health",
    healthcheckTimeout: 300,
  });

  const convexBackend = service("convex-backend", {
    source: image(
      `ghcr.io/get-convex/convex-backend:${convexImageRevision}`,
    ),
    healthcheck: "/version",
    healthcheckTimeout: 300,
  });
  const convexDashboard = service("convex-dashboard", {
    source: image(
      `ghcr.io/get-convex/convex-dashboard:${convexImageRevision}`,
    ),
  });
  const database = postgres("Postgres");
  const files = bucket("rcp-files", { region: "iad" });

  return project("Race Crew Planner", {
    resources: [web, convexBackend, convexDashboard, database, files],
  });
});
