"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { EventWorkspaceProvider } from "@/components/workspace/event-workspace";
import { OfflineSync } from "@/components/offline-sync";
import { MobileWorkspaceNavigation } from "@/components/workspace/mobile-workspace-navigation";
import { WorkspaceTopbar } from "@/components/workspace/workspace-topbar";
import { eventsApi, invitationsApi } from "@/lib/events-api";
import { canAccessScreen, findScreenByPath } from "@/lib/screens";
import { claimAuthenticatedInvitations } from "@/lib/invitations-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const hasConvexConnection =
  typeof convexUrl === "string" && convexUrl.length > 0;

/** Centred message for the states where no workspace can be shown. */
function ShellNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-7 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
    </main>
  );
}

function ShellLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-muted"
      role="status"
    >
      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      Loading your event workspace…
    </div>
  );
}

function ConnectedShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const events = useQuery(eventsApi.list, isSignedIn ? {} : "skip");
  const syncProfile = useMutation(invitationsApi.syncProfile);
  const pathname = usePathname();
  const [needsVerifiedEmail, setNeedsVerifiedEmail] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    void syncProfile()
      .then(() => claimAuthenticatedInvitations())
      .then((result) => setNeedsVerifiedEmail(result.requiresVerifiedEmail))
      .catch(() => undefined);
  }, [isSignedIn, syncProfile]);

  if (!isLoaded || (isSignedIn && events === undefined)) {
    return <ShellLoading />;
  }

  if (!isSignedIn) {
    return (
      <ShellNotice title="Sign in to open this event">
        <p className="text-sm leading-relaxed text-muted">
          Events and crew access are protected by your account.
        </p>
        <Link
          href="/sign-in"
          className={`${buttonVariants({ variant: "primary" })} w-fit`}
        >
          Sign in
        </Link>
      </ShellNotice>
    );
  }

  const event = (events ?? []).find((candidate) => candidate.id === eventId);

  if (event === undefined) {
    return (
      <ShellNotice title="This event is not available to you">
        <p className="text-sm leading-relaxed text-muted">
          Either the event does not exist, or your account is not a member of
          it. Ask the event owner for an invitation, then try again.
        </p>
        <Link
          href="/events"
          className={`${buttonVariants({ variant: "primary" })} w-fit`}
        >
          Back to your events
        </Link>
      </ShellNotice>
    );
  }

  const screen = findScreenByPath(event.id, pathname);

  return (
    <EventWorkspaceProvider event={event} events={events ?? []}>
      {needsVerifiedEmail ? (
        <p
          className="border-b border-warning-ln bg-warning-bg px-4 py-2 text-center text-sm text-warning-tx"
          role="status"
        >
          Add and verify a primary email in your account menu to accept event
          invitations.
        </p>
      ) : null}
      <OfflineSync eventId={eventId} />
      <div className="flex min-h-screen">
        <a
          href="#workspace-content"
          className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper focus:not-sr-only focus:outline-3 focus:outline-focus focus:outline-offset-2"
        >
          Skip to workspace content
        </a>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileWorkspaceNavigation />
          {screen === null ? null : <WorkspaceTopbar screen={screen} />}
          <main
            id="workspace-content"
            className="mx-auto w-full max-w-[1220px] flex-1 px-4 py-5 pb-24 sm:px-7 sm:py-7"
          >
            {screen !== null && !canAccessScreen(event.role, screen) ? (
              <Card>
                <CardHeader>
                  <CardTitle>You do not have access to this screen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted">
                    {screen.label} is limited to the {screen.minRole} role. Your
                    role on this event is {event.role}.
                  </p>
                </CardContent>
              </Card>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </EventWorkspaceProvider>
  );
}

export function WorkspaceShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  if (!hasConvexConnection) {
    return (
      <ShellNotice title="Event data is not connected">
        <p className="text-sm leading-relaxed text-muted">
          This application needs its matching Convex environment before it can
          display events.
        </p>
      </ShellNotice>
    );
  }

  return (
    <ErrorBoundary
      fallback={(retry) => (
        <ShellNotice title="Event data could not be loaded">
          <p className="text-sm leading-relaxed text-muted">
            The Convex environment for this deployment rejected the request,
            which usually means its functions are older than this application.
            If you had just submitted something, check whether it went through
            before you try again.
          </p>
          <Button variant="secondary" className="w-fit" onClick={retry}>
            Retry
          </Button>
        </ShellNotice>
      )}
    >
      <ConnectedShell eventId={eventId}>{children}</ConnectedShell>
    </ErrorBoundary>
  );
}
