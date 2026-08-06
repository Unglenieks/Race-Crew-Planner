"use client";

import { Check, Circle, LoaderCircle, Pencil, RotateCcw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { workApi, type WorkItem } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type EventRole = "owner" | "manager" | "crew";
type WorkFilter = "open" | "completed" | "all";
type Draft = { title: string; notes: string };

const emptyDraft: Draft = { title: "", notes: "" };

function itemToDraft(item: WorkItem): Draft {
  return { title: item.title, notes: item.notes ?? "" };
}

function isSameDraft(left: Draft, right: Draft) {
  return left.title === right.title && left.notes === right.notes;
}

export function WorkChecklist({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const items = useQuery(workApi.list, { eventId });
  const createItem = useMutation(workApi.create);
  const updateItem = useMutation(workApi.update);
  const setCompletion = useMutation(workApi.setCompletion);
  const canManage = role === "owner" || role === "manager";
  const [filter, setFilter] = useState<WorkFilter>("open");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [undoCompletion, setUndoCompletion] = useState<{
    item: WorkItem;
    completed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCount = useMemo(
    () => (items ?? []).filter((item) => item.status === "open").length,
    [items],
  );
  const completedCount = (items?.length ?? 0) - openCount;
  const visibleItems = useMemo(
    () =>
      (items ?? []).filter(
        (item) => filter === "all" || item.status === filter,
      ),
    [filter, items],
  );
  const initialDraft =
    editingItem === null ? emptyDraft : itemToDraft(editingItem);
  const hasUnsavedChanges = !isSameDraft(draft, initialDraft);

  function cancelEditing() {
    setEditingItem(null);
    setDraft(emptyDraft);
    setError(null);
  }

  function beginEditing(item: WorkItem) {
    setEditingItem(item);
    setDraft(itemToDraft(item));
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const input = {
      eventId,
      title: draft.title,
      notes: draft.notes || undefined,
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
      await setCompletion({ eventId, itemId: item._id, completed });
      setUndoCompletion({ item, completed });
    } catch {
      setError(
        "We could not update this work item. Its status was not changed.",
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function undoLastCompletion() {
    if (undoCompletion === null) return;
    await changeCompletion(undoCompletion.item, !undoCompletion.completed);
    setUndoCompletion(null);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Work checklist</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {openCount} open · {completedCount} completed
            </p>
          </div>
          <Badge variant={canManage ? "success" : "neutral"}>
            {canManage ? "Can manage" : "Can complete"}
          </Badge>
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
            />
          ) : (
            <>
              <div
                className="flex flex-wrap gap-2 border-b border-line pb-4"
                aria-label="Filter work items"
              >
                {(
                  [
                    ["open", `Open (${openCount})`],
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
                          className="shrink-0"
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
                          <p
                            className={
                              isCompleted
                                ? "font-semibold text-muted line-through"
                                : "font-semibold text-ink"
                            }
                          >
                            {item.title}
                          </p>
                          {item.notes === undefined ? null : (
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        {canManage ? (
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

      {canManage ? (
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
                {editingItem === null ? null : (
                  <Button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
