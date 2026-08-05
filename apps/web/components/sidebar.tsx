"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Route,
  Users,
  FileText,
  Archive,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Today", href: "/", icon: LayoutDashboard },
  { label: "Plan", href: "/plan", icon: Route },
  { label: "Work", href: "/work", icon: ClipboardList },
  { label: "Records", href: "/records", icon: Users },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Files", href: "/files", icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();

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

        <button
          type="button"
          className="w-full text-left border border-btnline bg-card rounded-lg px-3 py-2.5 text-sm cursor-pointer min-h-[44px] hover:bg-soft transition-colors"
        >
          <b className="block text-sm font-semibold">
            This Weekend at The Ridge
          </b>
          <small className="block text-xs text-muted mt-0.5">
            Aug 8–10 · Car #262
          </small>
        </button>
      </div>

      <nav className="flex-1 px-3">
        <span className="block text-[11px] font-mono text-faint uppercase tracking-wider mx-2 mb-1.5 mt-2">
          Modules
        </span>
        <div className="grid gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors min-h-[38px]",
                  active ? "bg-green text-card" : "text-ink2 hover:bg-soft",
                )}
              >
                <Icon className="w-4 h-4 flex-none" />
                {item.label}
              </Link>
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
