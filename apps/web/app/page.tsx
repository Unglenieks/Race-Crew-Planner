import { UserButton } from "@clerk/nextjs";
import { ConnectionStatus } from "@/components/connection-status";
import { DisplayModeControl } from "@/components/display-mode-control";
import { Sidebar } from "@/components/sidebar";
import { EventContext } from "@/components/event-context";

export default function Home() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-7 py-16">
        <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
          Race Planner
        </p>
        <h1 className="mt-2 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-tight tracking-tight">
          Development preview
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted">
          The application shell is deployed. Clerk authentication will appear
          here when the development publishable key is configured.
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-line bg-topbg px-6 py-2.5">
          <p className="mr-auto text-xs text-muted">Event workspace</p>
          <DisplayModeControl />
          <ConnectionStatus />
          <UserButton />
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-7 py-8 pb-24">
          <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
            Race Planner
          </p>
          <h1 className="mt-1 font-serif text-[clamp(28px,3.6vw,38px)] font-semibold leading-tight tracking-tight">
            Your event workspace
          </h1>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
            Start with today&apos;s movement plan, then use the event context to
            manage the shared plan and crew access.
          </p>
          <div className="mt-7">
            <EventContext />
          </div>
        </main>
      </div>
    </div>
  );
}
