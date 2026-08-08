"use client";

import { ClipboardPaste, Copy, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ItineraryItem } from "@/lib/events-api";

export type StagedMovement = {
  id: string;
  scheduledFor: string;
  title: string;
  location: string;
  operationalDay: string;
  team: string;
  movementType: string;
  tags: string;
};

const makeRow = (partial: Partial<StagedMovement> = {}): StagedMovement => ({
  id: crypto.randomUUID(),
  scheduledFor: "",
  title: "",
  location: "",
  operationalDay: "",
  team: "",
  movementType: "",
  tags: "",
  ...partial,
});

export function itemToStagedRow(item: ItineraryItem) {
  return makeRow({
    title: item.title,
    location: item.location ?? "",
    operationalDay: item.operationalDay ?? "",
    team: item.team ?? "",
    movementType: item.movementType ?? "",
    tags: item.tags?.join(", ") ?? "",
  });
}

export function ItineraryStagingGrid({
  onSave,
  isSaving,
}: {
  onSave: (rows: StagedMovement[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [rows, setRows] = useState<StagedMovement[]>([makeRow()]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const update = (id: string, key: keyof StagedMovement, value: string) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  const add = (after?: number) => {
    setRows((current) => {
      const next = [...current];
      next.splice(after === undefined ? next.length : after + 1, 0, makeRow());
      return next;
    });
    requestAnimationFrame(() => firstInput.current?.focus());
  };
  const duplicate = (index: number) =>
    setRows((current) => {
      const source = current[index];
      const next = [...current];
      next.splice(index + 1, 0, makeRow({ ...source, scheduledFor: "" }));
      return next;
    });
  const remove = (id: string) => {
    setRows((current) =>
      current.length === 1
        ? [makeRow()]
        : current.filter((row) => row.id !== id),
    );
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };
  const applyBulk = (key: keyof StagedMovement, value: string) => {
    if (selected.size === 0) return;
    setRows((current) =>
      current.map((row) =>
        selected.has(row.id) ? { ...row, [key]: value } : row,
      ),
    );
  };
  const pasteRows = () => {
    const parsed = pasteValue
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [
          scheduledFor = "",
          title = "",
          location = "",
          operationalDay = "",
          team = "",
          movementType = "",
          tags = "",
        ] = line.split("\t");
        return makeRow({
          scheduledFor,
          title,
          location,
          operationalDay,
          team,
          movementType,
          tags,
        });
      });
    if (!parsed.length) return;
    setRows((current) => [
      ...current.filter((row) =>
        Object.values(row).some((value) => value !== "" && value !== row.id),
      ),
      ...parsed,
    ]);
    setPasteValue("");
  };
  const save = async () => {
    const populated = rows.filter(
      (row) => row.title.trim() || row.scheduledFor.trim(),
    );
    if (populated.length === 0)
      return setError("Add at least one movement before saving.");
    const invalid = populated.find(
      (row) => !row.title.trim() || !row.scheduledFor,
    );
    if (invalid)
      return setError("Every staged row needs both a time and description.");
    setError(null);
    await onSave(populated);
    setRows([makeRow()]);
    setSelected(new Set());
    requestAnimationFrame(() => firstInput.current?.focus());
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        Paste tab-separated rows in this order: time, description, venue,
        operational day, team, type, tags. Tab moves naturally between cells.
      </p>
      <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-soft p-3">
        <textarea
          value={pasteValue}
          onChange={(event) => setPasteValue(event.target.value)}
          placeholder="Paste spreadsheet rows here"
          aria-label="Paste spreadsheet rows"
          className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink shadow-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={pasteRows}
          disabled={!pasteValue.trim()}
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Paste rows
        </Button>
        {(
          [
            "location",
            "operationalDay",
            "team",
            "movementType",
            "tags",
          ] as const
        ).map((key) => (
          <Input
            key={key}
            className="max-w-40"
            placeholder={`Bulk ${key === "movementType" ? "type" : key}`}
            onChange={(event) => applyBulk(key, event.target.value)}
            disabled={selected.size === 0}
            aria-label={`Set ${key} for selected rows`}
          />
        ))}
      </div>
      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <thead className="bg-soft text-xs text-muted">
            <tr>
              <th className="w-10 p-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-2">Time</th>
              <th className="p-2">Description</th>
              <th className="p-2">Venue</th>
              <th className="p-2">Operational day</th>
              <th className="p-2">Team</th>
              <th className="p-2">Type</th>
              <th className="p-2">Tags</th>
              <th className="p-2">Row</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(row.id)) {
                          next.delete(row.id);
                        } else {
                          next.add(row.id);
                        }
                        return next;
                      })
                    }
                    aria-label={`Select row ${index + 1}`}
                  />
                </td>
                {(
                  [
                    "scheduledFor",
                    "title",
                    "location",
                    "operationalDay",
                    "team",
                    "movementType",
                    "tags",
                  ] as const
                ).map((key) => (
                  <td key={key} className="p-1">
                    <Input
                      ref={
                        index === 0 && key === "scheduledFor"
                          ? firstInput
                          : undefined
                      }
                      type={key === "scheduledFor" ? "datetime-local" : "text"}
                      value={row[key]}
                      onChange={(event) =>
                        update(row.id, key, event.target.value)
                      }
                      required={key === "scheduledFor" || key === "title"}
                      aria-label={`${key} for row ${index + 1}`}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() => add(index)}
                      aria-label={`Insert row after ${index + 1}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() => duplicate(index)}
                      aria-label={`Duplicate row ${index + 1}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => remove(row.id)}
                      aria-label={`Delete row ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => add()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add row
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void save()}
          disabled={isSaving}
        >
          {isSaving
            ? "Adding…"
            : `Add ${rows.filter((row) => row.title || row.scheduledFor).length || "rows"}`}
        </Button>
      </div>
    </div>
  );
}
