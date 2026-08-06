"use client";

import {
  Archive,
  ClipboardPlus,
  LoaderCircle,
  Minus,
  Plus,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  type WorkTemplate,
  type WorkTemplateItem,
  workTemplatesApi,
} from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

type DraftItem = WorkTemplateItem & { id: number };

const firstItem: DraftItem = {
  id: 1,
  title: "",
  priority: "normal",
  notes: "",
  dueContext: "",
};

function details(item: WorkTemplateItem) {
  return [
    item.priority !== "normal" ? `${item.priority} priority` : null,
    item.dueContext ? `Due: ${item.dueContext}` : null,
    item.notes ? item.notes : null,
  ].filter((value): value is string => value !== null);
}

export function WorkTemplates({ eventId }: { eventId: string }) {
  const templates = useQuery(workTemplatesApi.list, { eventId });
  const create = useMutation(workTemplatesApi.create);
  const apply = useMutation(workTemplatesApi.apply);
  const archive = useMutation(workTemplatesApi.archive);
  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([firstItem]);
  const [nextItemId, setNextItemId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(
    null,
  );
  const [archiveTarget, setArchiveTarget] = useState<WorkTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: nextItemId,
        title: "",
        priority: "normal",
        notes: "",
        dueContext: "",
      },
    ]);
    setNextItemId((current) => current + 1);
  }

  function updateItem(id: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await create({
        eventId,
        name,
        items: items.map((item) => ({
          title: item.title,
          priority: item.priority,
          notes: item.notes || undefined,
          dueContext: item.dueContext || undefined,
        })),
      });
      setName("");
      setItems([{ ...firstItem, id: nextItemId }]);
      setNextItemId((current) => current + 1);
      setMessage("Template created and ready to apply.");
    } catch {
      setError(
        "The template was not created. Check its name and items, then try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyTemplate(template: WorkTemplate) {
    setError(null);
    setMessage(null);
    setPendingTemplateId(template._id);
    try {
      const ids = await apply({ eventId, templateId: template._id });
      setMessage(
        `${template.name} added ${ids.length} independent work item${ids.length === 1 ? "" : "s"} to the checklist.`,
      );
    } catch {
      setError("The template could not be applied. No work items were added.");
    } finally {
      setPendingTemplateId(null);
    }
  }

  async function archiveTemplate() {
    if (archiveTarget === null) return;
    setError(null);
    setMessage(null);
    setPendingTemplateId(archiveTarget._id);
    try {
      await archive({ eventId, templateId: archiveTarget._id });
      setMessage(
        `${archiveTarget.name} was archived and is no longer available to apply.`,
      );
      setArchiveTarget(null);
    } catch {
      setError("The template could not be archived. Please try again.");
    } finally {
      setPendingTemplateId(null);
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Available templates</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Apply a template to create independent checklist items for this
                event.
              </p>
            </div>
            <Badge variant="success">Managers can manage</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {message === null ? null : (
            <Banner variant="success" label="Template updated" role="status">
              {message}
            </Banner>
          )}
          {error === null ? null : (
            <Banner
              variant="danger"
              label="Template update failed"
              role="alert"
            >
              {error}
            </Banner>
          )}
          {archiveTarget === null ? null : (
            <Banner variant="danger" label="Archive template">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Archive <strong>{archiveTarget.name}</strong>? Existing work
                  items stay unchanged.
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setArchiveTarget(null)}
                    disabled={pendingTemplateId !== null}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={archiveTemplate}
                    disabled={pendingTemplateId !== null}
                  >
                    {pendingTemplateId === archiveTarget._id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    )}
                    Archive
                  </Button>
                </span>
              </div>
            </Banner>
          )}
          {templates === undefined ? (
            <div
              className="flex min-h-32 items-center text-sm text-muted"
              role="status"
            >
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="Create a reusable checklist for work your crew repeats."
            />
          ) : (
            <ol className="divide-y divide-line">
              {templates.map((template) => (
                <li
                  key={template._id}
                  className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{template.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {template.items.length} checklist item
                      {template.items.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-3 grid gap-1.5 text-sm text-muted">
                      {template.items.map((item, index) => (
                        <li key={`${template._id}-${index}`}>
                          <span className="font-medium text-ink2">
                            {item.title}
                          </span>
                          {details(item).length === 0 ? null : (
                            <span> · {details(item).join(" · ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => applyTemplate(template)}
                      disabled={pendingTemplateId !== null}
                    >
                      {pendingTemplateId === template._id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
                      )}
                      Apply
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setArchiveTarget(template)}
                      disabled={pendingTemplateId !== null}
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Archive
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New template</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={createTemplate}>
            <label
              className="grid gap-1.5 text-sm font-medium text-ink"
              htmlFor="template-name"
            >
              Template name
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                placeholder="e.g. Service arrival"
              />
            </label>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">Checklist items</p>
                <Button type="button" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add item
                </Button>
              </div>
              {items.map((item, index) => (
                <fieldset
                  key={item.id}
                  className="grid gap-3 rounded-lg border border-line p-3"
                >
                  <legend className="px-1 text-xs font-semibold text-muted">
                    Item {index + 1}
                  </legend>
                  <label
                    className="grid gap-1.5 text-sm font-medium text-ink"
                    htmlFor={`template-item-${item.id}`}
                  >
                    Task
                    <Input
                      id={`template-item-${item.id}`}
                      value={item.title}
                      onChange={(event) =>
                        updateItem(item.id, { title: event.target.value })
                      }
                      maxLength={160}
                      required
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      className="grid gap-1.5 text-sm font-medium text-ink"
                      htmlFor={`template-priority-${item.id}`}
                    >
                      Priority
                      <select
                        id={`template-priority-${item.id}`}
                        value={item.priority}
                        onChange={(event) =>
                          updateItem(item.id, {
                            priority: event.target
                              .value as WorkTemplateItem["priority"],
                          })
                        }
                        className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label
                      className="grid gap-1.5 text-sm font-medium text-ink"
                      htmlFor={`template-due-${item.id}`}
                    >
                      Due context{" "}
                      <span className="font-normal text-muted">(optional)</span>
                      <Input
                        id={`template-due-${item.id}`}
                        value={item.dueContext ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            dueContext: event.target.value,
                          })
                        }
                        maxLength={160}
                      />
                    </label>
                  </div>
                  <label
                    className="grid gap-1.5 text-sm font-medium text-ink"
                    htmlFor={`template-notes-${item.id}`}
                  >
                    Notes{" "}
                    <span className="font-normal text-muted">(optional)</span>
                    <textarea
                      id={`template-notes-${item.id}`}
                      value={item.notes ?? ""}
                      onChange={(event) =>
                        updateItem(item.id, { notes: event.target.value })
                      }
                      maxLength={1000}
                      className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="justify-self-start"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((candidate) => candidate.id !== item.id),
                      )
                    }
                    disabled={items.length === 1}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                    Remove item
                  </Button>
                </fieldset>
              ))}
            </div>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Create template
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
