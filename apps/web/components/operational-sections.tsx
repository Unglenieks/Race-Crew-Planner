"use client";

import {
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  planSectionsApi,
  type EventRole,
  type PlanSection,
} from "@/lib/events-api";

type Draft = {
  name: string;
  kind: PlanSection["kind"];
  operationalDate: string;
  boundaryTime: string;
};

const emptyDraft: Draft = {
  name: "",
  kind: "day",
  operationalDate: "",
  boundaryTime: "",
};

function sectionDraft(section: PlanSection): Draft {
  return {
    name: section.name,
    kind: section.kind,
    operationalDate: section.operationalDate ?? "",
    boundaryTime: section.boundaryTime ?? "",
  };
}

/** Manages the named operating-day structure that movements can be assigned to. */
export function OperationalSections({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const sections = useQuery(planSectionsApi.list, { eventId });
  const create = useMutation(planSectionsApi.create);
  const update = useMutation(planSectionsApi.update);
  const reorder = useMutation(planSectionsApi.reorder);
  const canEdit = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function set(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const input = {
      eventId,
      name: draft.name,
      kind: draft.kind,
      operationalDate: draft.operationalDate || undefined,
      boundaryTime: draft.boundaryTime || undefined,
    };
    try {
      if (editing === null) await create(input);
      else await update({ ...input, sectionId: editing });
      setDraft(emptyDraft);
      setEditing(null);
    } catch {
      setMessage(
        "The operational day could not be saved. Please check the date and boundary time.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function move(section: PlanSection, direction: -1 | 1) {
    if (sections === undefined) return;
    const source = sections.findIndex(
      (candidate) => candidate._id === section._id,
    );
    const target = source + direction;
    if (target < 0 || target >= sections.length) return;
    setSaving(true);
    setMessage(null);
    const ids = sections.map((candidate) => candidate._id);
    [ids[source], ids[target]] = [ids[target], ids[source]];
    try {
      await reorder({ eventId, sectionIds: ids });
    } catch {
      setMessage("The operational-day order could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational days & sections</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Name the working order separately from calendar dates. Assign a
          movement explicitly when an after-midnight item still belongs to the
          prior day.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {sections === undefined ? (
          <p className="text-sm text-muted" role="status">
            Loading operational days…
          </p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted">
            No operational days or sections yet. Movements can still use a
            calendar operating day.
          </p>
        ) : (
          <ol className="grid gap-2">
            {sections.map((section, index) => (
              <li
                key={section._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-ink">{section.name}</p>
                  <p className="text-xs text-muted">
                    {section.kind}
                    {section.operationalDate
                      ? ` · ${section.operationalDate}`
                      : ""}
                    {section.boundaryTime
                      ? ` · boundary ${section.boundaryTime}`
                      : ""}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Move ${section.name} earlier`}
                      disabled={saving || index === 0}
                      onClick={() => void move(section, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Move ${section.name} later`}
                      disabled={saving || index === sections.length - 1}
                      onClick={() => void move(section, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(section._id);
                        setDraft(sectionDraft(section));
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {canEdit ? (
          <form
            className="grid gap-3 border-t border-line pt-4"
            onSubmit={save}
          >
            <p className="font-semibold text-sm text-ink">
              {editing === null
                ? "Add operational day or section"
                : "Edit operational day or section"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-ink">
                Name
                <input
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                  maxLength={120}
                  required
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Type
                <select
                  value={draft.kind}
                  onChange={(event) => set("kind", event.target.value)}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal"
                >
                  <option value="day">Operating day</option>
                  <option value="session">Session</option>
                  <option value="leg">Leg</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Calendar anchor{" "}
                <span className="font-normal text-muted">(optional)</span>
                <input
                  type="date"
                  value={draft.operationalDate}
                  onChange={(event) =>
                    set("operationalDate", event.target.value)
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Day boundary{" "}
                <span className="font-normal text-muted">(optional)</span>
                <input
                  type="time"
                  value={draft.boundaryTime}
                  onChange={(event) => set("boundaryTime", event.target.value)}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm font-normal"
                />
              </label>
            </div>
            {message === null ? null : (
              <p role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : editing === null ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                {editing === null ? "Add section" : "Save section"}
              </Button>
              {editing === null ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null);
                    setDraft(emptyDraft);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
