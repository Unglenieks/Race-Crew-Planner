import {
  bucket,
  defineRailway,
  github,
  postgres,
  project,
  service,
} from "railway/iac";

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

  // These services intentionally remain source-free until a separately
  // reviewed PR pins the supported Convex self-hosted images and their
  // required environment-variable contract.
  const convexBackend = service("convex-backend");
  const convexDashboard = service("convex-dashboard");
  const database = postgres("Postgres");
  const files = bucket("rcp-files", { region: "iad" });

  return project("Race Crew Planner", {
    resources: [web, convexBackend, convexDashboard, database, files],
  });
});
