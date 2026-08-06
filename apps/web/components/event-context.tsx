"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { eventsApi, type EventSummary } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Input } from "@/components/ui/input";
import { ItineraryPlan } from "@/components/itinerary-plan";
import { TeamManagement } from "@/components/team-management";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const hasConvexConnection =
  typeof convexUrl === "string" && convexUrl.length > 0;

function EventPicker({
  events,
  selectedEventId,
  onSelect,
}: {
  events: EventSummary[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}) {
  return (
    <div className="grid gap-2" aria-label="Your events">
      {events.map((event) => {
        const isSelected = event.id === selectedEventId;

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            aria-pressed={isSelected}
            className="flex w-full items-center gap-3 rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                {event.name}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {event.timeZone}
              </span>
            </span>
            <Badge variant={event.role === "owner" ? "success" : "neutral"}>
              {event.role}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function CreateEventForm({
  onCreated,
}: {
  onCreated: (eventId: string) => void;
}) {
  const createEvent = useMutation(eventsApi.create);
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
      onCreated(eventId);
    } catch {
      setError(
        "We could not create the event. Your information was not saved.",
      );
    } finally {
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
          className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <CalendarPlus className="h-4 w-4" />
        )}
        Create event
      </Button>
    </form>
  );
}

function EventConnectionUnavailable() {
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

function EventConnectionFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event data could not be loaded</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-relaxed text-muted">
          The Convex environment for this deployment rejected the request, which
          usually means its functions are older than this application. If you
          had just submitted something, check whether it went through before you
          try again. Report the problem if it repeats.
        </p>
        <Button variant="secondary" className="w-fit" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectedEventContext() {
  const { isLoaded, isSignedIn } = useAuth();
  const events = useQuery(eventsApi.list, isSignedIn ? {} : "skip");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
        Loading your event context…
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
          <CreateEventForm onCreated={setSelectedEventId} />
        </CardContent>
      </Card>
    );
  }

  const selectedEvent =
    signedInEvents.find((event) => event.id === selectedEventId) ??
    signedInEvents[0];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your events</CardTitle>
        </CardHeader>
        <CardContent>
          <EventPicker
            events={signedInEvents}
            selectedEventId={selectedEvent.id}
            onSelect={setSelectedEventId}
          />
        </CardContent>
      </Card>
      <ItineraryPlan
        key={selectedEvent.id}
        eventId={selectedEvent.id}
        eventName={selectedEvent.name}
        timeZone={selectedEvent.timeZone}
        role={selectedEvent.role}
      />
      {selectedEvent.role === "owner" ? (
        <TeamManagement eventId={selectedEvent.id} />
      ) : null}
    </div>
  );
}

export function EventContext() {
  if (!hasConvexConnection) {
    return <EventConnectionUnavailable />;
  }

  return (
    <ErrorBoundary
      fallback={(retry) => <EventConnectionFailed onRetry={retry} />}
    >
      <ConnectedEventContext />
    </ErrorBoundary>
  );
}
