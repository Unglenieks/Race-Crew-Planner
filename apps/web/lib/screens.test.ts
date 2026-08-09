import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultScreenId,
  canAccessScreen,
  findScreenByPath,
  getScreen,
  roleSatisfies,
  screenGroups,
  screenHref,
  screens,
  visibleScreens,
} from "./screens";

const workspaceRoot = join(__dirname, "..", "app", "events", "[eventId]");

/**
 * Routes that are deliberately reachable only from a parent screen rather than
 * from the sidebar. Listing them explicitly keeps the guardrail meaningful: a
 * new unregistered screen still fails the test, and removing a route from the
 * registry still requires a conscious entry here.
 */
const nonNavigableSegments = new Set([
  "plan/publish",
  "plan/sections",
  "records/types",
]);

/** Every static `page.tsx` under the workspace route, as a path segment. */
function routeSegments(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Object detail routes are opened from their parent list and cannot be
      // sidebar destinations, because they need an object id to exist.
      if (entry.startsWith("[")) continue;
      found.push(
        ...routeSegments(full, prefix === "" ? entry : `${prefix}/${entry}`),
      );
    } else if (entry === "page.tsx" && prefix !== "") {
      found.push(prefix);
    }
  }
  return found;
}

describe("screen registry", () => {
  it("has a route file for every navigable screen", () => {
    // The previous sidebar advertised Work, Records, and Files with no route or
    // anchor behind them. This makes that state impossible to ship.
    const missing = screens.filter(
      (screen) => !existsSync(join(workspaceRoot, screen.segment, "page.tsx")),
    );

    expect(missing.map((screen) => screen.segment)).toEqual([]);
  });

  it("has a registry entry for every workspace route", () => {
    // The reverse direction: a screen that exists but is unreachable from
    // navigation is just as broken as a link with no screen.
    const registered = new Set(screens.map((screen) => screen.segment));
    const orphans = routeSegments(workspaceRoot).filter(
      (segment) =>
        !registered.has(segment) && !nonNavigableSegments.has(segment),
    );

    expect(orphans).toEqual([]);
  });

  it("keeps the non-navigable allowlist honest", () => {
    // An allowlisted segment must actually exist and must not also be a
    // registered screen, so the list cannot rot into a blanket exemption.
    const registered = new Set(screens.map((screen) => screen.segment));
    for (const segment of nonNavigableSegments) {
      expect(existsSync(join(workspaceRoot, segment, "page.tsx"))).toBe(true);
      expect(registered.has(segment)).toBe(false);
    }
  });

  it("places every primary screen in exactly one navigation group", () => {
    const grouped = screenGroups.flatMap((group) => group.screenIds);

    expect([...grouped].sort()).toEqual(
      screens
        .filter((screen) => !screen.hidden)
        .map((screen) => screen.id)
        .sort(),
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("resolves registered nested screens to their parent screen", () => {
    const sections = findScreenByPath("e1", "/events/e1/plan/sections");
    const plan = findScreenByPath("e1", screenHref("e1", "plan"));

    expect(sections?.id).toBe("plan");
    expect(plan?.id).toBe("plan");
  });

  it("returns no screen for a path outside the workspace", () => {
    expect(findScreenByPath("e1", "/events")).toBeNull();
    expect(findScreenByPath("e1", "/events/e2/today")).toBeNull();
  });

  it("keeps crew-only pages out of spectator navigation", () => {
    const crewIds = visibleScreens("crew").map((screen) => screen.id);
    const spectatorIds = visibleScreens("spectator").map((screen) => screen.id);

    expect(crewIds).toContain("map");
    expect(crewIds).toContain("contacts");
    expect(spectatorIds).toEqual(["today", "event-info", "spectator-info"]);
    expect(canAccessScreen("spectator", getScreen("map"))).toBe(false);
    expect(canAccessScreen("spectator", getScreen("schedule"))).toBe(false);
    expect(canAccessScreen("spectator", getScreen("contacts"))).toBe(false);
  });

  it("ranks roles so owners satisfy manager-only screens", () => {
    expect(roleSatisfies("owner", "manager")).toBe(true);
    expect(roleSatisfies("manager", "manager")).toBe(true);
    expect(roleSatisfies("crew", "manager")).toBe(false);
    expect(roleSatisfies("crew", "crew")).toBe(true);
    expect(roleSatisfies("spectator", "crew")).toBe(false);
  });

  it("lands on a screen every role can open", () => {
    expect(roleSatisfies("crew", getScreen(defaultScreenId).minRole)).toBe(
      true,
    );
  });
});
