"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Public landing page. Signed-in operators are pointed at `/events`, which is
 * the entry to the workspace shell. Kept deliberately free of Convex queries so
 * it renders for anonymous visitors.
 */
export function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-7 pb-44 pt-16 sm:pb-32">
      <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
        Race Planner
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-tight tracking-tight text-ink">
        Plan race crews with confidence.
      </h1>
      <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted">
        One shared movement plan, work checklists, records, and change delivery
        for the people running an event — built for weak signal and partial
        attention.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {!isLoaded ? (
          <p
            className="flex items-center gap-2 text-sm text-muted"
            role="status"
          >
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking your session…
          </p>
        ) : isSignedIn ? (
          <Link
            href="/events"
            className={buttonVariants({ variant: "primary" })}
          >
            Open your workspace
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "primary" })}
            >
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants()}>
              Create an account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
