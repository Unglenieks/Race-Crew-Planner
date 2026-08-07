import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const required = [
  "AGENTS.md",
  "README.md",
  "docs/implementation-plan.md",
  "docs/platform.md",
  "docs/delivery.md",
  "docs/agent-worktrees.md",
  ".github/pull_request_template.md",
];

const missing = required.filter((path) => !existsSync(resolve(root, path)));
if (missing.length > 0) {
  throw new Error(
    `Required repository files are missing: ${missing.join(", ")}`,
  );
}

const links = [
  ...readFileSync(resolve(root, "README.md"), "utf8").matchAll(
    /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g,
  ),
];
const broken = links
  .map((match) => match[1])
  .filter(
    (target) =>
      !target.startsWith("http") && !existsSync(resolve(root, target)),
  );

if (broken.length > 0) {
  throw new Error(`README has broken local links: ${broken.join(", ")}`);
}

console.log("Repository bootstrap checks passed.");
