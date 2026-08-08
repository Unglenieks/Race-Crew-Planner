"use client";

import { Check, LoaderCircle, Radio, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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

function displayTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ChangeStatus({
  change,
  canManage,
  pendingRecipientId,
  onAcknowledge,
  onAcknowledgeElsewhere,
}: {
  change: PublishedPlanChange;
  canManage: boolean;
  pendingRecipientId: string | null;
  onAcknowledge: (recipientId: string) => Promise<void>;
  onAcknowledgeElsewhere: (recipientId: string) => Promise<void>;
}) {
  const reached = change.recipients.filter(
    (recipient) =>
      recipient.state === "acknowledged" ||
      recipient.state === "acknowledgedElsewhere",
  ).length;
  const currentRecipient = change.currentRecipient;
  const needsMyAcknowledgement =
    currentRecipient !== undefined &&
    currentRecipient.state !== "acknowledged" &&
    currentRecipient.state !== "acknowledgedElsewhere";

  return (
    <li className="grid gap-3 border-t border-line py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{change.title}</p>
          <p className="mt-1 text-sm text-muted">{change.reason}</p>
          {change.movementTypeLabel === undefined &&
          (change.tagLabels ?? []).length === 0 &&
          (change.assignmentLabels ?? []).length === 0 ? null : (
            <p className="mt-1 text-xs text-muted">
              {[change.movementTypeLabel, ...(change.tagLabels ?? [])]
                .filter((value): value is string => value !== undefined)
                .join(" · ")}
              {(change.assignmentLabels ?? []).length === 0
                ? ""
                : ` · Assigned: ${change.assignmentLabels?.join(", ")}`}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Published by {change.publishedByName} ·{" "}
            {displayTime(change.publishedAt)}
          </p>
        </div>
        <Badge variant={change.severity === "critical" ? "danger" : "neutral"}>
          {change.severity}
        </Badge>
      </div>
      {change.previousTitle === undefined ? null : (
        <p className="rounded-md bg-topbg px-3 py-2 text-xs text-muted">
          Previous instruction: {change.previousScheduledFor} ·{" "}
          {change.previousTitle}
          {change.previousMovementTypeLabel === undefined &&
          (change.previousTagLabels ?? []).length === 0 &&
          (change.previousAssignmentLabels ?? []).length === 0
            ? ""
            : ` · ${[
                change.previousMovementTypeLabel,
                ...(change.previousTagLabels ?? []),
              ]
                .filter((value): value is string => value !== undefined)
                .join(" · ")}${
                (change.previousAssignmentLabels ?? []).length === 0
                  ? ""
                  : ` · Assigned: ${change.previousAssignmentLabels?.join(", ")}`
              }`}
        </p>
      )}
      {needsMyAcknowledgement ? (
        <div className="rounded-lg border border-warning-ln bg-warning-bg p-3">
          <p className="text-sm text-warning-tx">
            Review this change, then confirm that you have read it and will act.
          </p>
          <Button
            className="mt-3"
            type="button"
            variant="primary"
            disabled={pendingRecipientId === currentRecipient._id}
            onClick={() => void onAcknowledge(currentRecipient._id)}
          >
            {pendingRecipientId === currentRecipient._id ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            Review and acknowledge
          </Button>
        </div>
      ) : currentRecipient === undefined ? null : (
        <p className="text-sm font-medium text-success-tx">
          You acknowledged this change.
        </p>
      )}
      <p className="text-sm text-ink" aria-live="polite">
        {reached} of {change.recipients.length} acknowledged
      </p>
      <ul className="grid gap-2" aria-label="Recipient acknowledgement state">
        {change.recipients.map((recipient) => {
          const acknowledgedElsewhere =
            recipient.state === "acknowledgedElsewhere";
          const acknowledged =
            recipient.state === "acknowledged" || acknowledgedElsewhere;
          return (
            <li
              key={recipient._id}
              className="flex flex-wrap items-center gap-2 rounded-md bg-topbg px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-ink">{recipient.name}</span>
              <span className="text-muted">
                {acknowledged
                  ? acknowledgedElsewhere
                    ? `Recorded by ${recipient.acknowledgedByName ?? "operator"}`
                    : `Acknowledged by ${recipient.acknowledgedByName ?? recipient.name}`
                  : recipient.state === "opened"
                    ? "Opened"
                    : "Sent"}
              </span>
              {canManage && !acknowledged ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pendingRecipientId === recipient._id}
                  onClick={() => void onAcknowledgeElsewhere(recipient._id)}
                >
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  Record radio / phone
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function PlanChangeDelivery({
  eventId,
  role,
  items,
  movementId,
  openComposer = false,
}: {
  eventId: string;
  role: EventRole;
  items: ItineraryItem[];
  movementId: string;
  openComposer?: boolean;
}) {
  const canManage = role === "owner" || role === "manager";
  const recipients = useQuery(
    planChangesApi.recipients,
    canManage ? { eventId } : "skip",
  );
  const changes = useQuery(planChangesApi.listForMovement, {
    eventId,
    itemId: movementId,
  });
  const publish = useMutation(planChangesApi.publish);
  const markOpened = useMutation(planChangesApi.markOpened);
  const acknowledge = useMutation(planChangesApi.acknowledge);
  const acknowledgeElsewhere = useMutation(planChangesApi.acknowledgeElsewhere);
  const [isComposerOpen, setIsComposerOpen] = useState(
    canManage && openComposer,
  );
  const [publishedSuccessfully, setPublishedSuccessfully] = useState(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"routine" | "critical">("routine");
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null);
  const [pendingRecipientId, setPendingRecipientId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    for (const change of changes ?? []) {
      if (change.currentRecipient?.state === "sent") {
        void markOpened({
          eventId,
          recipientId: change.currentRecipient._id,
        }).catch(() => undefined);
      }
    }
  }, [changes, eventId, markOpened]);

  const selectedRecipientIds =
    recipientIds ?? recipients?.map((recipient) => recipient.userId) ?? [];

  function toggleRecipient(userId: string) {
    setRecipientIds((current) => {
      const selected =
        current ?? recipients?.map((recipient) => recipient.userId) ?? [];
      return selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId];
    });
  }

  async function onPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPublishing(true);
    try {
      await publish({
        eventId,
        itemId: movementId,
        reason,
        severity,
        recipientUserIds: selectedRecipientIds,
      });
      setReason("");
      setSeverity("routine");
      setRecipientIds(null);
      setPublishedSuccessfully(true);
      setIsComposerOpen(false);
    } catch {
      setError(
        "This change was not published. Check the details and try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function acknowledgeForMe(recipientId: string) {
    setPendingRecipientId(recipientId);
    setError(null);
    try {
      await acknowledge({ eventId, recipientId });
    } catch {
      setError("That acknowledgement could not be recorded. Please try again.");
    } finally {
      setPendingRecipientId(null);
    }
  }

  async function recordAcknowledgementElsewhere(recipientId: string) {
    setPendingRecipientId(recipientId);
    setError(null);
    try {
      await acknowledgeElsewhere({
        eventId,
        recipientId,
        note: "Acknowledged by radio, phone, or in person.",
      });
    } catch {
      setError("That operator acknowledgement could not be recorded.");
    } finally {
      setPendingRecipientId(null);
    }
  }

  return (
    <Card id="published-changes">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Published change history</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Review delivery and acknowledgement for this movement.
            </p>
          </div>
          {canManage && !isComposerOpen ? (
            <Button
              type="button"
              variant={publishedSuccessfully ? "secondary" : "primary"}
              onClick={() => {
                setPublishedSuccessfully(false);
                setIsComposerOpen(true);
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {publishedSuccessfully
                ? "Publish another change"
                : "Publish change"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {publishedSuccessfully ? (
          <p
            className="rounded-md border border-success-ln bg-success-bg px-3 py-2 text-sm text-success-tx"
            role="status"
          >
            Change published. Delivery status is shown below.
          </p>
        ) : null}
        {canManage && isComposerOpen ? (
          recipients === undefined ? (
            <p className="text-sm text-muted" role="status">
              Loading recipients…
            </p>
          ) : (
            <form
              className="grid gap-4 rounded-lg border border-line p-4"
              onSubmit={onPublish}
            >
              <p className="text-sm text-muted">
                Publishing the saved instruction for{" "}
                <strong className="text-ink">{items[0]?.title}</strong>.
              </p>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Reason or source
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  required
                  className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 font-normal"
                />
              </label>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-ink">
                  Severity
                </legend>
                {(["routine", "critical"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm capitalize text-ink"
                  >
                    <input
                      type="radio"
                      checked={severity === value}
                      onChange={() => setSeverity(value)}
                    />
                    {value}
                  </label>
                ))}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="primary"
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )
        ) : null}
        {error === null ? null : (
          <p className="text-sm text-danger-tx" role="alert">
            {error}
          </p>
        )}
        {changes === undefined ? (
          <p className="text-sm text-muted" role="status">
            Loading published changes…
          </p>
        ) : changes.length === 0 ? (
          <p className="text-sm text-muted">
            No changes have been published for this movement.
          </p>
        ) : (
          <ol>
            {changes.map((change) => (
              <ChangeStatus
                key={change._id}
                change={change}
                canManage={canManage}
                pendingRecipientId={pendingRecipientId}
                onAcknowledge={acknowledgeForMe}
                onAcknowledgeElsewhere={recordAcknowledgementElsewhere}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
