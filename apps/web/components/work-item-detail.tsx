"use client";

import { Check, ChevronLeft, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  itineraryApi,
  recordsApi,
  workApi,
  type EventRole,
  type WorkItem,
} from "@/lib/events-api";

type Draft = {
  title: string;
  notes: string;
  status: WorkItem["status"];
  priority: NonNullable<WorkItem["priority"]>;
  dueContext: string;
  assigneeId: string;
  recordId: string;
  itineraryItemId: string;
};

const statusLabels: Record<WorkItem["status"], string> = {
  open: "Open",
  inProgress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

function toDraft(item: WorkItem): Draft {
  return {
    title: item.title,
    notes: item.notes ?? "",
    status: item.status,
    priority: item.priority ?? "normal",
    dueContext: item.dueContext ?? "",
    assigneeId: item.assigneeId ?? "",
    recordId: item.recordId ?? "",
    itineraryItemId: item.itineraryItemId ?? "",
  };
}

function dateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function WorkItemDetail({
  eventId,
  itemId,
  role,
}: {
  eventId: string;
  itemId: string;
  role: EventRole;
}) {
  const item = useQuery(workApi.get, { eventId, itemId });
  const assignees = useQuery(workApi.listAssignees, { eventId });
  const records = useQuery(recordsApi.list, { eventId });
  const movements = useQuery(itineraryApi.list, { eventId });
  const comments = useQuery(workApi.listComments, { eventId, itemId });
  const update = useMutation(workApi.update);
  const setCompletion = useMutation(workApi.setCompletion);
  const addComment = useMutation(workApi.addComment);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const canManage = role === "owner" || role === "manager";
  const currentDraft = draft ?? (item === undefined ? null : toDraft(item));
  const linkedRecord = useMemo(
    () => records?.find((record) => record._id === item?.recordId),
    [item?.recordId, records],
  );
  const linkedMovement = useMemo(
    () => movements?.find((movement) => movement._id === item?.itineraryItemId),
    [item?.itineraryItemId, movements],
  );

  if (
    item === undefined ||
    assignees === undefined ||
    records === undefined ||
    movements === undefined ||
    comments === undefined
  ) {
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading work item…
      </p>
    );
  }
  const workItem = item;

  function updateDraft(field: keyof Draft, value: string) {
    setDraft(
      (current) =>
        ({ ...(current ?? toDraft(workItem)), [field]: value }) as Draft,
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentDraft === null) return;
    setError(null);
    setIsSaving(true);
    try {
      await update({
        eventId,
        itemId,
        title: currentDraft.title,
        notes: currentDraft.notes || undefined,
        status: currentDraft.status,
        priority: currentDraft.priority,
        dueContext: currentDraft.dueContext || undefined,
        assigneeId: currentDraft.assigneeId || undefined,
        recordId: currentDraft.recordId || null,
        itineraryItemId: currentDraft.itineraryItemId || null,
      });
      setDraft(null);
    } catch {
      setError(
        "We could not save this work item. Your changes were not saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function complete() {
    setError(null);
    setIsCompleting(true);
    try {
      await setCompletion({
        eventId,
        itemId,
        completed: workItem.status !== "completed",
      });
    } catch {
      setError(
        "We could not update this work item. Its status was not changed.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment.trim().length === 0) return;
    setError(null);
    setIsCommenting(true);
    try {
      await addComment({ eventId, itemId, body: comment });
      setComment("");
    } catch {
      setError("We could not add this comment. Please try again.");
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href={`/events/${eventId}/work`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-green-ink underline-offset-4 hover:underline"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Work
              </Link>
              <CardTitle className="mt-3">{item.title}</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Complete it quickly, then keep assignment and handoff context in
                one place.
              </p>
            </div>
            <Badge variant={canManage ? "success" : "neutral"}>
              {canManage ? "Can manage" : "Can complete"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error === null ? null : (
            <Banner
              variant="danger"
              label="Work item update failed"
              role="alert"
            >
              {error}
            </Banner>
          )}
          <Button
            type="button"
            variant={item.status === "completed" ? "secondary" : "primary"}
            onClick={() => void complete()}
            disabled={isCompleting}
            className="w-fit"
          >
            {isCompleting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {item.status === "completed" ? "Reopen work item" : "Mark complete"}
          </Button>
          {canManage && currentDraft !== null ? (
            <form className="grid gap-4" onSubmit={save}>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Task
                <Input
                  value={currentDraft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Owner
                  <select
                    value={currentDraft.assigneeId}
                    onChange={(event) =>
                      updateDraft("assigneeId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal text-ink shadow-sm"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.userId} value={assignee.userId}>
                        {assignee.name ?? assignee.userId} ({assignee.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Status
                  <select
                    value={currentDraft.status}
                    onChange={(event) =>
                      updateDraft("status", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal text-ink shadow-sm"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Due context
                  <Input
                    value={currentDraft.dueContext}
                    onChange={(event) =>
                      updateDraft("dueContext", event.target.value)
                    }
                    maxLength={160}
                    placeholder="e.g. Before service"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Priority
                  <select
                    value={currentDraft.priority}
                    onChange={(event) =>
                      updateDraft("priority", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal text-ink shadow-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Linked record
                  <select
                    value={currentDraft.recordId}
                    onChange={(event) =>
                      updateDraft("recordId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal text-ink shadow-sm"
                  >
                    <option value="">No linked record</option>
                    {records.map((record) => (
                      <option key={record._id} value={record._id}>
                        {record.name} · {record.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Linked movement
                  <select
                    value={currentDraft.itineraryItemId}
                    onChange={(event) =>
                      updateDraft("itineraryItemId", event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal text-ink shadow-sm"
                  >
                    <option value="">No linked movement</option>
                    {movements.map((movement) => (
                      <option key={movement._id} value={movement._id}>
                        {movement.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Notes <span className="font-normal text-muted">(optional)</span>
                <textarea
                  value={currentDraft.notes}
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  maxLength={1000}
                  className="min-h-28 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving}
                className="w-fit"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save work item
              </Button>
            </form>
          ) : (
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="font-semibold text-ink">Status</dt>
                <dd className="mt-1 text-muted">{statusLabels[item.status]}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted">
                  {item.notes ?? "No notes"}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <p className="font-semibold text-ink">Owner</p>
              <p className="mt-1 text-muted">
                {assignees.find((person) => person.userId === item.assigneeId)
                  ?.name ??
                  item.assigneeId ??
                  "Unassigned"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Due context</p>
              <p className="mt-1 text-muted">
                {item.dueContext ?? "No due context"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Linked record</p>
              <p className="mt-1 text-muted">
                {linkedRecord
                  ? `${linkedRecord.name} · ${linkedRecord.type}`
                  : "No linked record"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Linked movement</p>
              <p className="mt-1 text-muted">
                {linkedMovement?.title ?? "No linked movement"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Handoff notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted">No handoff notes yet.</p>
            ) : (
              <ol className="grid gap-3">
                {comments.map((entry) => (
                  <li
                    key={entry._id}
                    className="border-b border-line pb-3 last:border-0 last:pb-0"
                  >
                    <p className="whitespace-pre-wrap text-sm text-ink">
                      {entry.body}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {entry.authorName ?? entry.authorId} ·{" "}
                      {dateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <form className="grid gap-2" onSubmit={submitComment}>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Add handoff note
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1000}
                  className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink shadow-sm"
                />
              </label>
              <Button
                type="submit"
                variant="secondary"
                disabled={isCommenting || comment.trim().length === 0}
                className="w-fit"
              >
                {isCommenting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}{" "}
                Add note
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
