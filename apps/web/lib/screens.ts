import {
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  MapPinned,
  MessageSquare,
  Route,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EventRole } from "@/lib/events-api";

export type ScreenId =
  | "today"
  | "map"
  | "contacts"
  | "schedule"
  | "event-info"
  | "spectator-info"
  | "attention"
  | "plan"
  | "plan-import"
  | "plan-export"
  | "work"
  | "work-templates"
  | "records"
  | "travel"
  | "logistics"
  | "files"
  | "offline"
  | "forms"
  | "activity"
  | "people";

export type ScreenDefinition = {
  id: ScreenId;
  segment: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  minRole: EventRole;
  /** Hidden routes remain available to existing workflows but do not crowd the new menu. */
  hidden?: boolean;
  /** Use this for non-hierarchical audiences such as spectator-only pages. */
  allowedRoles?: EventRole[];
};

const roleRank: Record<EventRole, number> = {
  spectator: 0,
  crew: 1,
  manager: 2,
  owner: 3,
};

export function roleSatisfies(role: EventRole, minRole: EventRole): boolean {
  return roleRank[role] >= roleRank[minRole];
}

export function canAccessScreen(role: EventRole, screen: ScreenDefinition) {
  return (
    screen.allowedRoles?.includes(role) ?? roleSatisfies(role, screen.minRole)
  );
}

const core: ScreenDefinition[] = [
  {
    id: "today",
    segment: "today",
    label: "Event home",
    shortLabel: "Home",
    description: "Your race at a glance.",
    icon: LayoutDashboard,
    minRole: "spectator",
  },
  {
    id: "map",
    segment: "map",
    label: "Map",
    shortLabel: "Map",
    description: "Race venues and crew support locations.",
    icon: MapPinned,
    minRole: "crew",
  },
  {
    id: "contacts",
    segment: "contacts",
    label: "Contacts",
    shortLabel: "Contacts",
    description: "Event officials and your crew roster.",
    icon: Users,
    minRole: "crew",
  },
  {
    id: "schedule",
    segment: "schedule",
    label: "Schedule",
    shortLabel: "Schedule",
    description: "The event movement plan by day.",
    icon: CalendarDays,
    minRole: "crew",
  },
  {
    id: "event-info",
    segment: "event-info",
    label: "Event info",
    shortLabel: "Event info",
    description: "Car, legs, mileage, fuel, and weather.",
    icon: Gauge,
    minRole: "spectator",
  },
  {
    id: "spectator-info",
    segment: "spectator-info",
    label: "Spectator info",
    shortLabel: "Spectator info",
    description: "Spectator locations and event-day essentials.",
    icon: MapPinned,
    minRole: "spectator",
  },
];

const legacy: ScreenDefinition[] = [
  {
    id: "attention",
    segment: "attention",
    label: "Attention & acknowledgements",
    shortLabel: "Attention",
    description:
      "Work assigned to you and plan changes awaiting your response.",
    icon: ClipboardList,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "plan",
    segment: "plan",
    label: "Movement plan",
    shortLabel: "Movement plan",
    description: "The shared schedule of movements for this event.",
    icon: Route,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "plan-import",
    segment: "plan/import",
    label: "Import plan",
    shortLabel: "Import",
    description: "Stage, review, and safely commit a schedule.",
    icon: FileText,
    minRole: "manager",
    hidden: true,
  },
  {
    id: "plan-export",
    segment: "plan/export",
    label: "Export & print",
    shortLabel: "Export",
    description: "A filtered, printable view of the plan.",
    icon: FileText,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "work",
    segment: "work",
    label: "Work & checklists",
    shortLabel: "Work",
    description: "Shared checklists and assignments.",
    icon: ClipboardList,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "work-templates",
    segment: "work/templates",
    label: "Checklist templates",
    shortLabel: "Templates",
    description: "Repeatable event work.",
    icon: ClipboardList,
    minRole: "manager",
    hidden: true,
  },
  {
    id: "records",
    segment: "records",
    label: "Records & venues",
    shortLabel: "Records",
    description: "Places, services, vehicles, equipment, and organisations.",
    icon: MapPinned,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "travel",
    segment: "records/travel",
    label: "Travel reference",
    shortLabel: "Travel",
    description: "Place-to-place estimates and notes.",
    icon: Route,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "logistics",
    segment: "logistics",
    label: "Rally logistics",
    shortLabel: "Logistics",
    description: "Car, legs, fuel, service, weather, and support.",
    icon: Gauge,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "files",
    segment: "files",
    label: "Files & sources",
    shortLabel: "Files",
    description: "Event evidence and record files.",
    icon: FolderOpen,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "offline",
    segment: "offline",
    label: "Offline manager",
    shortLabel: "Offline",
    description: "Connection status and queued changes.",
    icon: FolderOpen,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "forms",
    segment: "forms",
    label: "Forms & inspections",
    shortLabel: "Forms",
    description: "Templates and submissions.",
    icon: FileText,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "activity",
    segment: "activity",
    label: "Activity & comments",
    shortLabel: "Activity",
    description: "Event history and comments.",
    icon: MessageSquare,
    minRole: "crew",
    hidden: true,
  },
  {
    id: "people",
    segment: "people",
    label: "People & permissions",
    shortLabel: "People",
    description: "Crew access and invitations.",
    icon: Users,
    minRole: "owner",
    hidden: true,
  },
];

export const screens = [...core, ...legacy];
export type ScreenGroup = { label: string | null; screenIds: ScreenId[] };
export const screenGroups: ScreenGroup[] = [
  { label: null, screenIds: core.map((screen) => screen.id) },
];
const screensById = new Map(screens.map((screen) => [screen.id, screen]));
export function getScreen(id: ScreenId) {
  const screen = screensById.get(id);
  if (!screen) throw new Error(`Unknown screen: ${id}`);
  return screen;
}
export function screenHref(eventId: string, id: ScreenId) {
  return `/events/${eventId}/${getScreen(id).segment}`;
}
export function visibleScreens(role: EventRole) {
  return screens.filter(
    (screen) => !screen.hidden && canAccessScreen(role, screen),
  );
}
export function findScreenByPath(
  eventId: string,
  pathname: string,
): ScreenDefinition | null {
  const matches = screens.filter((screen) => {
    const href = screenHref(eventId, screen.id);
    return pathname === href || pathname.startsWith(`${href}/`);
  });
  return matches.length === 0
    ? null
    : matches.reduce((longest, screen) =>
        longest.segment.length > screen.segment.length ? longest : screen,
      );
}
export const defaultScreenId: ScreenId = "today";
