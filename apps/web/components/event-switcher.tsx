"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  ChevronRight,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Input } from "@/components/ui/input";
import { eventsApi, invitationsApi, type EventSummary } from "@/lib/events-api";
import { defaultScreenId, screenHref } from "@/lib/screens";
import {
  eventTimeZones,
  localTimeZone,
  timeZoneOptions,
} from "@/lib/time-zones";
import { useHydrated } from "@/lib/use-hydrated";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const hasConvexConnection =
  typeof convexUrl === "string" && convexUrl.length > 0;

function EventList({
  events,
  onRemoveSample,
  removingSampleId,
}: {
  events: EventSummary[];
  onRemoveSample: (event: EventSummary) => void;
  removingSampleId: string | null;
}) {
  return (
    <div className="grid gap-2" aria-label="Your events">
      {events.map((event) => (
        <div key={event.id} className="flex items-stretch gap-2">
          <Link
            href={screenHref(event.id, defaultScreenId)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-ink2 focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
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
          {event.isSample && event.role === "owner" ? (
            <Button
              type="button"
              variant="secondary"
              className="h-auto shrink-0"
              disabled={removingSampleId === event.id}
              onClick={() => onRemoveSample(event)}
            >
              {removingSampleId === event.id ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              Remove sample
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CreateEventForm() {
  const createEvent = useMutation(eventsApi.create);
  const router = useRouter();
  const [name, setName] = useState("");
  // Starts empty on purpose. A pre-filled zone is the kind of default nobody
  // reads, and an event silently created in the wrong zone mis-times every
  // movement in it. `required` forces one deliberate choice.
  const [timeZone, setTimeZone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The zone list comes from the runtime's own ICU data, which differs between
  // the server and the browser, so rendering it during SSR risks a hydration
  // mismatch. The server emits only the placeholder and the list appears once
  // hydrated.
  const hydrated = useHydrated();
  const zoneOptions = useMemo(
    () => (hydrated ? timeZoneOptions([localTimeZone()], eventTimeZones) : []),
    [hydrated],
  );

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
        <select
          id="event-time-zone"
          name="timeZone"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
          required
          className="flex h-11 w-full rounded-lg border border-btnline bg-card px-3 py-2.5 text-sm font-medium text-ink shadow-sm focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          <option value="">Select a time zone</option>
          {timeZoneOptions([timeZone].filter(Boolean), zoneOptions).map(
            (zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ),
          )}
        </select>
        <p className="text-xs text-muted">
          Use the zone the event runs in, which is usually the venue&apos;s
          local time. Times will use this zone throughout the event.
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
  const createSample = useMutation(eventsApi.createSample);
  const removeSample = useMutation(eventsApi.removeSample);
  const router = useRouter();
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [creatingSample, setCreatingSample] = useState(false);
  const [removingSampleId, setRemovingSampleId] = useState<string | null>(null);

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

  async function createSampleEvent() {
    setSampleError(null);
    setCreatingSample(true);
    try {
      const eventId = await createSample({});
      router.push(screenHref(eventId, defaultScreenId));
    } catch {
      setSampleError(
        "We could not create the sample event. Nothing was saved.",
      );
      setCreatingSample(false);
    }
  }

  async function removeSampleEvent(event: EventSummary) {
    setSampleError(null);
    setRemovingSampleId(event.id);
    try {
      await removeSample({ eventId: event.id });
    } catch {
      setSampleError(
        "We could not remove the sample event. It is still available.",
      );
    } finally {
      setRemovingSampleId(null);
    }
  }

  if (signedInEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your first event</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-5">
          <p className="text-sm leading-relaxed text-muted">
            Explore a populated event first, or create one with its own local
            time zone. You will own either event.
          </p>
          <Button
            type="button"
            variant="primary"
            className="w-fit"
            disabled={creatingSample}
            onClick={createSampleEvent}
          >
            {creatingSample ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            Explore a sample event
          </Button>
          <p className="text-xs text-muted">
            The sample includes records, a configurable readiness field, a plan
            item, and a work item. Remove it at any time from this page.
          </p>
          {sampleError === null ? null : (
            <p
              className="rounded-md border border-danger-ln bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
            >
              {sampleError}
            </p>
          )}
          <p className="text-sm font-medium text-ink">
            Or create your own event
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
          <EventList
            events={signedInEvents}
            onRemoveSample={removeSampleEvent}
            removingSampleId={removingSampleId}
          />
          {sampleError === null ? null : (
            <p
              className="mt-3 rounded-md border border-danger-ln bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
            >
              {sampleError}
            </p>
          )}
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
