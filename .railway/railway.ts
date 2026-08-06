import {
  bucket,
  defineRailway,
  github,
  image,
  postgres,
  preserve,
  project,
  ref,
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
  // The existing shared dev lane is named "preview" in Railway. Keep it and
  // a future renamed "development" lane aligned with the dev branch.
  const branch =
    ctx.isEnvironment("development") || ctx.isEnvironment("preview")
      ? "dev"
      : "main";

  const convexBackend = service("convex-backend", {
    source: image(
      `ghcr.io/get-convex/convex-backend:${convexImageRevision}`,
    ),
    healthcheck: "/version",
    healthcheckTimeout: 300,
    env: {
      AWS_ACCESS_KEY_ID: preserve(),
      AWS_REGION: preserve(),
      AWS_S3_FORCE_PATH_STYLE: preserve(),
      AWS_SECRET_ACCESS_KEY: preserve(),
      CLERK_JWT_ISSUER_DOMAIN: preserve(),
      CONVEX_CLOUD_ORIGIN: preserve(),
      CONVEX_SELF_HOSTED_ADMIN_KEY: preserve(),
      CONVEX_SELF_HOSTED_URL: preserve(),
      CONVEX_SITE_ORIGIN: preserve(),
      DISABLE_BEACON: preserve(),
      DO_NOT_REQUIRE_SSL: preserve(),
      INSTANCE_SECRET: preserve(),
      PORT: preserve(),
      POSTGRES_URL: preserve(),
      RCP_BUCKET_accessKeyId: preserve(),
      RCP_BUCKET_bucketName: preserve(),
      RCP_BUCKET_endpoint: preserve(),
      RCP_BUCKET_region: preserve(),
      RCP_BUCKET_secretAccessKey: preserve(),
      S3_ENDPOINT_URL: preserve(),
      S3_STORAGE_EXPORTS_BUCKET: preserve(),
      S3_STORAGE_FILES_BUCKET: preserve(),
      S3_STORAGE_MODULES_BUCKET: preserve(),
      S3_STORAGE_SEARCH_BUCKET: preserve(),
      S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET: preserve(),
    },
  });

  // The web build publishes `convex/` to this environment's backend once the
  // application artifact has compiled, so a released client can never call
  // functions that are older than itself, and a failed build never mutates the
  // backend. A failed push fails the build by design.
  const web = service("web", {
    source: github("Unglenieks/Race-Crew-Planner", { branch }),
    build: "pnpm build && pnpm convex:deploy",
    start: "pnpm --filter @race-planner/web start",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    env: {
      CLERK_SECRET_KEY: preserve(),
      CONVEX_SELF_HOSTED_ADMIN_KEY: ref(
        convexBackend,
        "CONVEX_SELF_HOSTED_ADMIN_KEY",
      ),
      CONVEX_SELF_HOSTED_URL: ref(convexBackend, "CONVEX_CLOUD_ORIGIN"),
      NEXT_PUBLIC_APP_ENV: preserve(),
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: preserve(),
      NEXT_PUBLIC_CONVEX_URL: preserve(),
      NEXT_PUBLIC_POSTHOG_HOST: preserve(),
      NEXT_PUBLIC_POSTHOG_KEY: preserve(),
      NEXT_PUBLIC_RELEASE_SHA: preserve(),
    },
  });
  const convexDashboard = service("convex-dashboard", {
    source: image(
      `ghcr.io/get-convex/convex-dashboard:${convexImageRevision}`,
    ),
    env: { NEXT_PUBLIC_DEPLOYMENT_URL: preserve() },
  });
  const database = postgres("Postgres");
  const files = bucket("rcp-files", { region: "iad" });

  return project("Race Crew Planner", {
    resources: [web, convexBackend, convexDashboard, database, files],
  });
});
