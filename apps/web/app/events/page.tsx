import type { Metadata } from "next";
import { EventSwitcher } from "@/components/event-switcher";

export const metadata: Metadata = { title: "Your events · Race Planner" };

export default function EventsPage() {
  return (
    <main className="mx-auto w-full max-w-[1220px] px-7 py-10 pb-24">
      <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
        Race Planner
      </p>
      <h1 className="mt-1 font-serif text-[clamp(28px,3.6vw,38px)] font-semibold leading-tight tracking-tight text-ink">
        Your events
      </h1>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
        Open an event to reach its plan, work, records, and crew.
      </p>
      <div className="mt-7">
        <EventSwitcher />
      </div>
    </main>
  );
}
