"use client";

import { Check, LoaderCircle, Radio, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  planChangesApi,
  type EventRole,
  type ItineraryItem,
  type PublishedPlanChange,
} from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

function displayTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ChangeStatus({
  change,
  onAcknowledgeElsewhere,
}: {
  change: PublishedPlanChange;
  onAcknowledgeElsewhere: (recipientId: string) => Promise<void>;
}) {
  const reached = change.recipients.filter(
    (recipient) =>
      recipient.state === "acknowledged" ||
      recipient.state === "acknowledgedElsewhere",
  ).length;
  const pending = change.recipients.length - reached;

  return (
    <li className="grid gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{change.title}</p>
          <p className="mt-1 text-sm text-muted">{change.reason}</p>
          <p className="mt-1 text-xs text-muted">
            Published {displayTime(change.publishedAt)}
          </p>
        </div>
        <Badge variant={change.severity === "critical" ? "danger" : "neutral"}>
          {change.severity}
        </Badge>
      </div>
      <p className="text-sm text-ink" aria-live="polite">
        {reached} of {change.recipients.length} reached
        {pending === 0 ? "" : ` · ${pending} pending`}
      </p>
      <ul className="grid gap-2" aria-label="Recipient reach state">
        {change.recipients.map((recipient) => {
          const reachedByAnotherRoute =
            recipient.state === "acknowledgedElsewhere";
          const reached =
            recipient.state === "acknowledged" || reachedByAnotherRoute;
          return (
            <li
              key={recipient._id}
              className="flex flex-wrap items-center gap-2 rounded-md bg-topbg px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-ink">
                {recipient.name ?? recipient.userId}
              </span>
              <span className="text-muted">
                {reached
                  ? reachedByAnotherRoute
                    ? "Reached another way"
                    : "Acknowledged"
                  : recipient.state === "opened"
                    ? "Opened"
                    : "Pending"}
              </span>
              {reached ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void onAcknowledgeElsewhere(recipient._id)}
                >
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  Record radio / phone
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function PublisherDelivery({
  eventId,
  items,
  movementId,
}: {
  eventId: string;
  items: ItineraryItem[];
  movementId?: string;
}) {
  const recipients = useQuery(planChangesApi.recipients, { eventId });
  const changes = useQuery(planChangesApi.listForPublisher, { eventId });
  const publish = useMutation(planChangesApi.publish);
  const acknowledgeElsewhere = useMutation(planChangesApi.acknowledgeElsewhere);
  const [itemId, setItemId] = useState(
    movementId ?? (items.length === 1 ? (items[0]?._id ?? "") : ""),
  );
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"routine" | "critical">("routine");
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  function toggleRecipient(userId: string) {
    setRecipientIds((current) => {
      const selected =
        current ?? recipients?.map((recipient) => recipient.userId) ?? [];
      return selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId];
    });
  }

  const selectedRecipientIds =
    recipientIds ?? recipients?.map((recipient) => recipient.userId) ?? [];
  const visibleChanges =
    movementId === undefined
      ? changes
      : changes?.filter((change) => change.itineraryItemId === movementId);

  async function onPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPublishing(true);
    try {
      await publish({
        eventId,
        itemId,
        reason,
        severity,
        recipientUserIds: selectedRecipientIds,
      });
      setReason("");
    } catch {
      setError(
        "This change was not published. Check the details and try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function recordAcknowledgementElsewhere(recipientId: string) {
    try {
      await acknowledgeElsewhere({
        eventId,
        recipientId,
        note: "Acknowledged by radio, phone, or in person.",
      });
    } catch {
      setError("That acknowledgement could not be recorded. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Publish a plan change</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Publishing creates an attributable instruction and reports reach,
            not just send.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {items.length === 0 ? (
          <EmptyState
            title="Add a movement before publishing"
            description="A published change always refers to a current movement in the plan."
          />
        ) : recipients === undefined ? (
          <p className="flex items-center text-sm text-muted" role="status">
            <LoaderCircle
              className="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Loading available recipients…
          </p>
        ) : (
          <form className="grid gap-4" onSubmit={onPublish}>
            {movementId === undefined ? (
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="published-movement"
                >
                  Movement
                </label>
                <select
                  id="published-movement"
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                  required
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                >
                  <option value="" disabled>
                    Select the changed movement
                  </option>
                  {items.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.scheduledFor} · {item.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-lg border border-line bg-topbg px-3 py-2 text-sm text-muted">
                Publishing the saved change to{" "}
                <strong className="text-ink">{items[0]?.title}</strong>.
              </p>
            )}
            <div className="grid gap-1.5">
              <label
                className="text-sm font-medium text-ink"
                htmlFor="change-reason"
              >
                Reason or source
              </label>
              <textarea
                id="change-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
                className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                placeholder="e.g. Route control notified the team of a 15-minute delay."
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-ink">Severity</legend>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={severity === "routine"}
                  onChange={() => setSeverity("routine")}
                />
                Routine — recipients can acknowledge when available
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={severity === "critical"}
                  onChange={() => setSeverity("critical")}
                />
                Critical — acknowledgement needs follow-up
              </label>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-ink">
                Affected people
              </legend>
              {recipients.map((recipient) => (
                <label
                  key={recipient.userId}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipientIds.includes(recipient.userId)}
                    onChange={() => toggleRecipient(recipient.userId)}
                  />
                  <span className="flex-1">{recipient.name}</span>
                  <span className="text-xs text-muted">{recipient.role}</span>
                </label>
              ))}
            </fieldset>
            {error === null ? null : (
              <p
                className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-fit"
              disabled={isPublishing || selectedRecipientIds.length === 0}
            >
              {isPublishing ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Publish and track reach
            </Button>
          </form>
        )}
        {visibleChanges === undefined ? null : visibleChanges.length ===
          0 ? null : (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Published changes
            </h3>
            <ol>
              {visibleChanges.map((change) => (
                <ChangeStatus
                  key={change._id}
                  change={change}
                  onAcknowledgeElsewhere={recordAcknowledgementElsewhere}
                />
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecipientDelivery({ eventId }: { eventId: string }) {
  const changes = useQuery(planChangesApi.listForMe, { eventId });
  const acknowledge = useMutation(planChangesApi.acknowledge);
  const [isAcknowledging, setIsAcknowledging] = useState<string | null>(null);

  if (changes === undefined) return null;
  if (changes.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Changes needing your acknowledgement</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3">
          {changes.map(({ change, recipient }) =>
            change === null ? null : (
              <li
                key={recipient._id}
                className="rounded-lg border border-line p-4"
              >
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{change.title}</p>
                    <p className="mt-1 text-sm text-muted">{change.reason}</p>
                  </div>
                  <Badge
                    variant={
                      change.severity === "critical" ? "danger" : "neutral"
                    }
                  >
                    {change.severity}
                  </Badge>
                </div>
                {change.previousTitle === undefined ? null : (
                  <p className="mt-2 text-xs text-muted">
                    Previous instruction: {change.previousScheduledFor} ·{" "}
                    {change.previousTitle}
                  </p>
                )}
                <Button
                  className="mt-4"
                  type="button"
                  variant="primary"
                  disabled={isAcknowledging === recipient._id}
                  onClick={async () => {
                    setIsAcknowledging(recipient._id);
                    try {
                      await acknowledge({
                        eventId,
                        recipientId: recipient._id,
                      });
                    } finally {
                      setIsAcknowledging(null);
                    }
                  }}
                >
                  {isAcknowledging === recipient._id ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  I have read and will act
                </Button>
              </li>
            ),
          )}
        </ol>
      </CardContent>
    </Card>
  );
}

export function PlanChangeDelivery({
  eventId,
  role,
  items,
  movementId,
}: {
  eventId: string;
  role: EventRole;
  items: ItineraryItem[];
  movementId?: string;
}) {
  return role === "owner" || role === "manager" ? (
    <PublisherDelivery
      eventId={eventId}
      items={items}
      movementId={movementId}
    />
  ) : (
    <RecipientDelivery eventId={eventId} />
  );
}
