import { LandingPage } from "@/components/landing-page";

export default function Home() {
  // Without a Clerk key there is no session to read, so render a static notice
  // rather than a sign-in path that cannot work. This keeps the development
  // fallback deployable.
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === undefined) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-7 py-16">
        <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
          Race Planner
        </p>
        <h1 className="mt-2 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-tight tracking-tight text-ink">
          Development preview
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted">
          The application shell is deployed. Clerk authentication will appear
          here when the development publishable key is configured.
        </p>
      </main>
    );
  }

  return <LandingPage />;
}
