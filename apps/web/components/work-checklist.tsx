"use client";

import {
  Check,
  Circle,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  workApi,
  type EventRole,
  type WorkAssignee,
  type WorkItem,
} from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type WorkFilter = "open" | "completed" | "all";
type Priority = "low" | "normal" | "high";

/**
 * Labels the two statuses that are neither untouched nor finished. `open` needs
 * no label because it is the resting state, and `completed` already reads from
 * the checkbox and strikethrough.
 */
function inProgressOrBlockedLabel(status: WorkItem["status"]) {
  if (status === "inProgress") return "In progress";
  if (status === "blocked") return "Blocked";
  return null;
}

type Draft = {
  title: string;
  notes: string;
  priority: Priority;
  dueContext: string;
  assigneeId: string;
};

const emptyDraft: Draft = {
  title: "",
  notes: "",
  priority: "normal",
  dueContext: "",
  assigneeId: "",
};

function itemToDraft(item: WorkItem): Draft {
  return {
    title: item.title,
    notes: item.notes ?? "",
    priority: item.priority ?? "normal",
    dueContext: item.dueContext ?? "",
    assigneeId: item.assigneeId ?? "",
  };
}

function isSameDraft(left: Draft, right: Draft) {
  return (
    left.title === right.title &&
    left.notes === right.notes &&
    left.priority === right.priority &&
    left.dueContext === right.dueContext &&
    left.assigneeId === right.assigneeId
  );
}

export function WorkChecklist({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const items = useQuery(workApi.list, { eventId });
  const assignees = useQuery(workApi.listAssignees, { eventId });
  const createItem = useMutation(workApi.create);
  const updateItem = useMutation(workApi.update);
  const setCompletion = useMutation(workApi.setCompletion);
  const canManage = role === "owner" || role === "manager";
  const [filter, setFilter] = useState<WorkFilter>("open");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [undoCompletion, setUndoCompletion] = useState<{
    item: WorkItem;
    completed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const openCount = useMemo(
    () => (items ?? []).filter((item) => item.status !== "completed").length,
    [items],
  );
  const completedCount = (items?.length ?? 0) - openCount;
  const visibleItems = useMemo(
    () =>
      (items ?? []).filter(
        (item) =>
          filter === "all" ||
          (filter === "open" && item.status !== "completed") ||
          item.status === filter,
      ),
    [filter, items],
  );
  const initialDraft =
    editingItem === null ? emptyDraft : itemToDraft(editingItem);
  const hasUnsavedChanges = !isSameDraft(draft, initialDraft);

  useEffect(() => {
    if (isEditorOpen) titleInputRef.current?.focus();
  }, [isEditorOpen]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isEditorOpen || !hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges, isEditorOpen]);

  function cancelEditing() {
    setEditingItem(null);
    setDraft(emptyDraft);
    setError(null);
    setIsEditorOpen(false);
  }

  function beginAdding() {
    setEditingItem(null);
    setDraft(emptyDraft);
    setError(null);
    setIsEditorOpen(true);
  }

  function beginEditing(item: WorkItem) {
    setEditingItem(item);
    setDraft(itemToDraft(item));
    setError(null);
    setIsEditorOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const input = {
      eventId,
      title: draft.title,
      notes: draft.notes || undefined,
      priority: draft.priority,
      dueContext: draft.dueContext || undefined,
      assigneeId: draft.assigneeId || undefined,
    };

    try {
      if (editingItem === null) await createItem(input);
      else await updateItem({ ...input, itemId: editingItem._id });
      cancelEditing();
    } catch {
      setError(
        "We could not save this work item. Your changes were not saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeCompletion(item: WorkItem, completed: boolean) {
    setError(null);
    setPendingItemId(item._id);
    try {
      if (!navigator.onLine) {
        setError(
          "You are offline. Work changes cannot be saved until the connection returns.",
        );
        return false;
      }
      await setCompletion({ eventId, itemId: item._id, completed });
      setUndoCompletion({ item, completed });
      return true;
    } catch {
      setError(
        "We could not update this work item. Its status was not changed.",
      );
      return false;
    } finally {
      setPendingItemId(null);
    }
  }

  async function undoLastCompletion() {
    if (undoCompletion === null) return;
    const wasUndone = await changeCompletion(
      undoCompletion.item,
      !undoCompletion.completed,
    );
    if (wasUndone) setUndoCompletion(null);
  }

  return (
    <div
      className={`grid items-start gap-4 ${
        canManage ? "xl:grid-cols-[1.35fr_.65fr]" : ""
      }`}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Checklist</CardTitle>
              <p className="mt-1 text-sm text-muted">
                {openCount} open · {completedCount} completed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={canManage ? "success" : "neutral"}>
                {canManage ? "Can manage" : "Can complete"}
              </Badge>
              {canManage ? (
                <Button type="button" size="sm" onClick={beginAdding}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add work item
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {undoCompletion === null ? null : (
            <Banner variant="success" label="Checklist updated" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {undoCompletion.completed ? "Completed" : "Reopened"}{" "}
                  {undoCompletion.item.title}.
                </span>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={undoLastCompletion}
                  disabled={pendingItemId !== null}
                >
                  {pendingItemId === undoCompletion.item._id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Undo
                </Button>
              </div>
            </Banner>
          )}
          {error === null ? null : (
            <Banner variant="danger" label="Work update failed" role="alert">
              {error}
            </Banner>
          )}
          {items === undefined ? (
            <div
              className="flex min-h-32 items-center text-sm text-muted"
              role="status"
            >
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading work items…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No work items yet"
              description="Start a shared checklist with the next task the crew needs to complete."
              action={
                canManage ? (
                  <Button type="button" size="sm" onClick={beginAdding}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add work item
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div
                className="flex flex-wrap gap-2 border-b border-line pb-4"
                aria-label="Filter work items"
              >
                {(
                  [
                    // "Unfinished" rather than "Open": this bucket also holds
                    // in-progress and blocked items.
                    ["open", `Unfinished (${openCount})`],
                    ["completed", `Completed (${completedCount})`],
                    ["all", `All (${items.length})`],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={filter === value ? "primary" : "secondary"}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {visibleItems.length === 0 ? (
                <EmptyState
                  title={
                    filter === "completed"
                      ? "Nothing completed yet"
                      : "No open work"
                  }
                  description="Choose another filter to see the rest of the event checklist."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setFilter("all")}
                    >
                      Show all work
                    </Button>
                  }
                />
              ) : (
                <ol className="divide-y divide-line">
                  {visibleItems.map((item) => {
                    const isCompleted = item.status === "completed";
                    const isPending = pendingItemId === item._id;
                    return (
                      <li
                        key={item._id}
                        className="flex gap-3 py-4 first:pt-0 last:pb-0"
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant={isCompleted ? "soft" : "secondary"}
                          className="h-11 w-11 min-h-11 shrink-0 p-0"
                          aria-label={`${isCompleted ? "Reopen" : "Complete"} ${item.title}`}
                          onClick={() => changeCompletion(item, !isCompleted)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : isCompleted ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Circle className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span className="sr-only">
                            {isCompleted ? "Completed" : "Open"}
                          </span>
                        </Button>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/events/${eventId}/work/${item._id}`}
                            aria-label={`Open “${item.title}”`}
                            className={
                              isCompleted
                                ? "font-semibold text-muted line-through hover:underline"
                                : "font-semibold text-ink hover:underline"
                            }
                          >
                            {item.title}
                          </Link>
                          {item.notes === undefined ? null : (
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {item.notes}
                            </p>
                          )}
                          <WorkItemDetails item={item} assignees={assignees} />
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${item.title}`}
                              onClick={() => beginEditing(item)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {canManage && isEditorOpen ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {editingItem === null ? "Add work item" : "Edit work item"}
              </CardTitle>
              {hasUnsavedChanges ? (
                <p className="mt-1 text-sm text-warning-tx" role="status">
                  Draft changes are local to this form and have not been shared.
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="work-title"
                >
                  Task
                </label>
                <Input
                  id="work-title"
                  ref={titleInputRef}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  maxLength={160}
                  required
                  placeholder="e.g. Load spare wheel"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="work-priority"
                  >
                    Priority
                  </label>
                  <select
                    id="work-priority"
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        priority: event.target.value as Priority,
                      }))
                    }
                    className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="work-assignee"
                  >
                    Assigned to <span className="text-muted">(optional)</span>
                  </label>
                  <select
                    id="work-assignee"
                    value={draft.assigneeId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        assigneeId: event.target.value,
                      }))
                    }
                    disabled={assignees === undefined}
                    className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {(assignees ?? []).map((assignee) => (
                      <option key={assignee.userId} value={assignee.userId}>
                        {assignee.name} ({assignee.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="work-due-context"
                >
                  Due context <span className="text-muted">(optional)</span>
                </label>
                <Input
                  id="work-due-context"
                  value={draft.dueContext}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dueContext: event.target.value,
                    }))
                  }
                  maxLength={160}
                  placeholder="e.g. Before Friday service"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="work-notes"
                >
                  Notes <span className="text-muted">(optional)</span>
                </label>
                <textarea
                  id="work-notes"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  className="min-h-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-muted focus:border-ink focus:ring-2 focus:ring-ink"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : null}
                  {editingItem === null ? "Add work item" : "Save work item"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (
                      !hasUnsavedChanges ||
                      window.confirm("Discard these work-item changes?")
                    )
                      cancelEditing();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function WorkItemDetails({
  item,
  assignees,
}: {
  item: WorkItem;
  assignees: WorkAssignee[] | undefined;
}) {
  const assignee = assignees?.find(
    (person) => person.userId === item.assigneeId,
  );
  const details = [
    // Without this, `inProgress` and `blocked` items are indistinguishable from
    // untouched ones anywhere except the detail screen.
    inProgressOrBlockedLabel(item.status),
    item.priority && item.priority !== "normal"
      ? `${item.priority} priority`
      : null,
    item.dueContext ? `Due: ${item.dueContext}` : null,
    item.assigneeId
      ? `Assigned to: ${assignee?.name ?? item.assigneeName ?? "Profile pending"}`
      : null,
  ].filter((detail): detail is string => detail !== null);

  return details.length === 0 ? null : (
    <p className="mt-2 text-xs font-medium text-muted">{details.join(" · ")}</p>
  );
}
