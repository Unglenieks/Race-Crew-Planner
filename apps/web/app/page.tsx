import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/sidebar";
import { EventContext } from "@/components/event-context";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-line bg-topbg px-6 py-2.5">
          <p className="mr-auto text-xs text-muted">Event context</p>
          <UserButton />
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-7 py-8 pb-24">
          <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
            Race Planner
          </p>
          <h1 className="mt-1 font-serif text-[clamp(28px,3.6vw,38px)] font-semibold leading-tight tracking-tight">
            Choose your event
          </h1>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
            Your event sets the shared context for plans, work, records, and
            crew access.
          </p>
          <div className="mt-7">
            <EventContext />
          </div>
        </main>
      </div>
    </div>
  );
}
