import {
  LayoutDashboard,
  BellRing,
  ClipboardList,
  Route,
  Users,
  FileText,
  Archive,
} from "lucide-react";
import Link from "next/link";

const navItems = [
  { label: "Today", href: "#today", icon: LayoutDashboard, available: true },
  { label: "Attention", href: "#attention", icon: BellRing, available: true },
  { label: "Plan", href: "#plan", icon: Route, available: true },
  { label: "Event", href: "#event-context", icon: Users, available: true },
  { label: "Work", href: "#work", icon: ClipboardList, available: false },
  { label: "Records", href: "#records", icon: FileText, available: false },
  { label: "Files", href: "#files", icon: Archive, available: false },
];

export function Sidebar() {
  return (
    <aside className="w-[274px] flex-none border-r border-line bg-side overflow-auto h-screen sticky top-0 flex flex-col">
      <div className="p-4 pb-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-extrabold tracking-tight mx-2 mb-4"
        >
          <span className="inline-grid place-items-center w-[27px] h-[27px] rounded-lg bg-green text-lime text-sm font-bold">
            ⌁
          </span>
          race planner
        </Link>

        <div className="w-full text-left border border-btnline bg-card rounded-lg px-3 py-2.5 text-sm min-h-11">
          <b className="block text-sm font-semibold">
            This Weekend at The Ridge
          </b>
          <small className="block text-xs text-muted mt-0.5">
            Aug 8–10 · Car #262
          </small>
        </div>
      </div>

      <nav className="flex-1 px-3">
        <span className="block text-[11px] font-mono text-faint uppercase tracking-wider mx-2 mb-1.5 mt-2">
          Modules
        </span>
        <div className="grid gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const itemClassName =
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold min-h-11";

            if (item.available) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${itemClassName} text-ink2 hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2`}
                >
                  <Icon className="w-4 h-4 flex-none" />
                  {item.label}
                </Link>
              );
            }

            return (
              <span
                key={item.href}
                className={`${itemClassName} text-ink2`}
                aria-label={`${item.label} is not available in this release`}
              >
                <Icon className="w-4 h-4 flex-none" />
                {item.label}
                <span className="ml-auto text-xs font-normal text-muted">
                  Not released
                </span>
              </span>
            );
          })}
        </div>
      </nav>

      <div className="p-4 pt-3 text-[11px] font-mono text-muted leading-relaxed border-t border-line mt-auto">
        <b className="text-green-ink">Online</b>
        <span className="ml-2">v0.1.0</span>
      </div>
    </aside>
  );
}
