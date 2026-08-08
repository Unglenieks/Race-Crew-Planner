import {
  BellRing,
  ClipboardList,
  FileText,
  FolderOpen,
  CloudOff,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Printer,
  Route,
  Rows3,
  TableProperties,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EventRole } from "@/lib/events-api";

/**
 * Single source of truth for workspace navigation.
 *
 * The sidebar, the topbar breadcrumb, and route validation all read this list,
 * so a screen cannot appear in navigation without a route, and a route cannot
 * exist without a label. `tests/screens.test.ts` asserts every entry here has a
 * matching `page.tsx`, which is the regression guard for the previous shell
 * where navigation advertised screens that were never built.
 */

export type ScreenId =
  | "today"
  | "attention"
  | "plan"
  | "plan-import"
  | "plan-export"
  | "work"
  | "work-templates"
  | "records"
  | "travel"
  | "files"
  | "offline"
  | "forms"
  | "activity"
  | "people";

export type ScreenDefinition = {
  id: ScreenId;
  /** Path relative to `/events/[eventId]`. */
  segment: string;
  /** Sidebar label and breadcrumb tail. */
  label: string;
  /** Short label for the breadcrumb when the full label is long. */
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Lowest role permitted to open the screen. */
  minRole: EventRole;
};

const roleRank: Record<EventRole, number> = {
  crew: 0,
  manager: 1,
  owner: 2,
};

export function roleSatisfies(role: EventRole, minRole: EventRole): boolean {
  return roleRank[role] >= roleRank[minRole];
}

export const screens: ScreenDefinition[] = [
  {
    id: "today",
    segment: "today",
    label: "Today",
    shortLabel: "Today",
    description: "What is happening now and what is next.",
    icon: LayoutDashboard,
    minRole: "crew",
  },
  {
    id: "attention",
    segment: "attention",
    label: "Attention & acknowledgements",
    shortLabel: "Attention",
    description:
      "Work assigned to you and plan changes awaiting your response.",
    icon: BellRing,
    minRole: "crew",
  },
  {
    id: "plan",
    segment: "plan",
    label: "Movement plan",
    shortLabel: "Movement plan",
    description: "The shared schedule of movements for this event.",
    icon: Route,
    minRole: "crew",
  },
  {
    id: "plan-import",
    segment: "plan/import",
    label: "Import plan",
    shortLabel: "Import",
    description:
      "Stage, review, and safely commit a schedule from a file or pasted table.",
    icon: TableProperties,
    minRole: "manager",
  },
  {
    id: "plan-export",
    segment: "plan/export",
    label: "Export & print",
    shortLabel: "Export & print",
    description: "A filtered, printable view of the plan.",
    icon: Printer,
    minRole: "crew",
  },
  {
    id: "work",
    segment: "work",
    label: "Work & checklists",
    shortLabel: "Work",
    description: "Shared checklists and assignments for the crew.",
    icon: ClipboardList,
    minRole: "crew",
  },
  {
    id: "work-templates",
    segment: "work/templates",
    label: "Checklist templates",
    shortLabel: "Templates",
    description: "Create, apply, and archive repeatable event work.",
    icon: Rows3,
    minRole: "manager",
  },
  {
    id: "records",
    segment: "records",
    label: "Records & venues",
    shortLabel: "Records",
    description: "Places, services, vehicles, equipment, and organisations.",
    icon: MapPin,
    minRole: "crew",
  },
  {
    id: "travel",
    segment: "records/travel",
    label: "Travel reference",
    shortLabel: "Travel",
    description: "Place-to-place estimates and route notes for the event.",
    icon: MapPin,
    minRole: "crew",
  },
  {
    id: "files",
    segment: "files",
    label: "Files & sources",
    shortLabel: "Files",
    description: "Attach and retrieve event evidence and record files.",
    icon: FolderOpen,
    minRole: "crew",
  },
  {
    id: "offline",
    segment: "offline",
    label: "Offline manager",
    shortLabel: "Offline",
    description: "Connection status and durable queued changes.",
    icon: CloudOff,
    minRole: "crew",
  },
  {
    id: "forms",
    segment: "forms",
    label: "Forms & inspections",
    shortLabel: "Forms",
    description: "Templates to complete and submissions you have made.",
    icon: FileText,
    minRole: "crew",
  },
  {
    id: "activity",
    segment: "activity",
    label: "Activity & comments",
    shortLabel: "Activity",
    description: "Event history, comments, and linked sources.",
    icon: MessageSquare,
    minRole: "crew",
  },
  {
    id: "people",
    segment: "people",
    label: "People & permissions",
    shortLabel: "People",
    description: "Crew access, invitations, and roles.",
    icon: Users,
    minRole: "owner",
  },
];

export type ScreenGroup = {
  /** `null` renders the screens without a group heading. */
  label: string | null;
  screenIds: ScreenId[];
};

export const screenGroups: ScreenGroup[] = [
  { label: null, screenIds: ["today", "attention"] },
  {
    label: "Plan",
    screenIds: ["plan", "plan-import", "plan-export"],
  },
  {
    label: "Work",
    screenIds: ["work", "work-templates"],
  },
  { label: "Records", screenIds: ["records", "travel", "files"] },
  { label: "Forms", screenIds: ["forms"] },
  { label: "Trust & setup", screenIds: ["activity", "offline", "people"] },
];

const screensById = new Map(screens.map((screen) => [screen.id, screen]));

export function getScreen(id: ScreenId): ScreenDefinition {
  const screen = screensById.get(id);
  if (screen === undefined) throw new Error(`Unknown screen: ${id}`);
  return screen;
}

export function screenHref(eventId: string, id: ScreenId): string {
  return `/events/${eventId}/${getScreen(id).segment}`;
}

export function visibleScreens(role: EventRole): ScreenDefinition[] {
  return screens.filter((screen) => roleSatisfies(role, screen.minRole));
}

/**
 * Resolves the screen a pathname belongs to. Longest segment wins so
 * `/plan/sections` resolves to Plan sections rather than Movement plan.
 */
export function findScreenByPath(
  eventId: string,
  pathname: string,
): ScreenDefinition | null {
  const matches = screens.filter((screen) => {
    const href = screenHref(eventId, screen.id);
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  if (matches.length === 0) return null;

  return matches.reduce((longest, screen) =>
    screen.segment.length > longest.segment.length ? screen : longest,
  );
}

/** The screen an operator lands on when they open an event. */
export const defaultScreenId: ScreenId = "today";
