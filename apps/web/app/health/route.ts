import { deploymentConfigurationIssues } from "@/lib/deployment-config";

export function GET() {
  const issues = deploymentConfigurationIssues(process.env);
  return Response.json(
    { status: issues.length === 0 ? "ok" : "misconfigured", issues },
    { status: issues.length === 0 ? 200 : 503 },
  );
}
