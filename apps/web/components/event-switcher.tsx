"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Input } from "@/components/ui/input";
import { eventsApi, invitationsApi, type EventSummary } from "@/lib/events-api";
import { defaultScreenId, screenHref } from "@/lib/screens";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const hasConvexConnection =
  typeof convexUrl === "string" && convexUrl.length > 0;

function EventList({ events }: { events: EventSummary[] }) {
  return (
    <div className="grid gap-2" aria-label="Your events">
      {events.map((event) => (
        <Link
          key={event.id}
          href={screenHref(event.id, defaultScreenId)}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-ink2 focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {event.name}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {event.timeZone}
            </span>
          </span>
          <Badge variant={event.role === "owner" ? "success" : "neutral"}>
            {event.role}
          </Badge>
          <ChevronRight
            className="h-4 w-4 flex-none text-muted"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}

function CreateEventForm() {
  const createEvent = useMutation(eventsApi.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const eventId = await createEvent({ name, timeZone });
      router.push(screenHref(eventId, defaultScreenId));
    } catch {
      setError(
        "We could not create the event. Your information was not saved.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-ink" htmlFor="event-name">
          Event name
        </label>
        <Input
          id="event-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
          autoComplete="off"
          placeholder="e.g. Pine Ridge Rally"
        />
      </div>
      <div className="grid gap-1.5">
        <label
          className="text-sm font-medium text-ink"
          htmlFor="event-time-zone"
        >
          Event time zone
        </label>
        <Input
          id="event-time-zone"
          name="timeZone"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted">
          Times will use this zone throughout the event.
        </p>
      </div>
      {error === null ? null : (
        <p
          className="rounded-md border border-danger-ln bg-danger-bg px-3 py-2 text-sm text-danger-tx"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        )}
        Create event
      </Button>
    </form>
  );
}

function ConnectedEventSwitcher() {
  const { isLoaded, isSignedIn } = useAuth();
  const events = useQuery(eventsApi.list, isSignedIn ? {} : "skip");
  const syncProfile = useMutation(invitationsApi.syncProfile);
  const claimInvitations = useMutation(invitationsApi.claim);

  useEffect(() => {
    if (!isSignedIn) return;
    void syncProfile()
      .then(() => claimInvitations())
      .catch(() => undefined);
  }, [claimInvitations, isSignedIn, syncProfile]);

  if (!isLoaded || (isSignedIn && events === undefined)) {
    return (
      <div
        className="flex min-h-48 items-center justify-center text-sm text-muted"
        role="status"
      >
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading your events…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to plan an event</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm leading-relaxed text-muted">
            Events and crew access are protected by your account.
          </p>
          <Link
            href="/sign-in"
            className={`${buttonVariants({ variant: "primary" })} w-fit`}
          >
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  const signedInEvents = events ?? [];

  if (signedInEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your first event</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-5">
          <p className="text-sm leading-relaxed text-muted">
            Start with the event name and its local time zone. You will be its
            owner and can add the plan and crew next.
          </p>
          <CreateEventForm />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Your events</CardTitle>
        </CardHeader>
        <CardContent>
          <EventList events={signedInEvents} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Create an event</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateEventForm />
        </CardContent>
      </Card>
    </div>
  );
}

export function EventSwitcher() {
  if (!hasConvexConnection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event data is not connected</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted">
            This application needs its matching Convex environment before it can
            display or create events.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ErrorBoundary
      fallback={(retry) => (
        <Card>
          <CardHeader>
            <CardTitle>Event data could not be loaded</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-relaxed text-muted">
              The Convex environment for this deployment rejected the request,
              which usually means its functions are older than this application.
            </p>
            <Button variant="secondary" className="w-fit" onClick={retry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    >
      <ConnectedEventSwitcher />
    </ErrorBoundary>
  );
}
