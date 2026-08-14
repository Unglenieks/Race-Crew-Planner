"use client";

import { MapPin, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { EventRecord } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A compact, accessible record picker used wherever a movement links a venue. */
export function VenueLinkCombobox({
  records,
  selectedId,
  onSelect,
  onCreate,
  disabled = false,
}: {
  records: readonly EventRecord[];
  selectedId: string;
  onSelect: (record: EventRecord | null) => void;
  onCreate?: (name: string) => void;
  disabled?: boolean;
}) {
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const selected = records.find((record) => record._id === selectedId);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) return records.slice(0, 8);
    return records.filter((record) =>
      [record.name, record.type, record.address]
        .filter((value): value is string => value !== undefined)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, records]);
  const createName = query.trim();

  return (
    <div className="grid gap-2">
      {selected === undefined ? null : (
        <div className="flex min-h-11 items-center gap-2 rounded-lg border border-success-ln bg-success-bg px-3 text-sm text-ink">
          <MapPin className="h-4 w-4 text-success-tx" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {selected.name}
            {selected.address === undefined ? "" : ` · ${selected.address}`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onSelect(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
      )}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          id="venue-link-search"
          name="venueLinkSearch"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder="Search venues by name, address, or type"
          className="pl-9"
          aria-label="Linked venue search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={resultsId}
          aria-expanded={!disabled}
        />
      </div>
      <ul
        id={resultsId}
        className="max-h-48 overflow-y-auto rounded-lg border border-line"
        aria-label="Venue search results"
        role="listbox"
      >
        {matches.map((record) => (
          <li key={record._id}>
            <button
              type="button"
              disabled={disabled}
              role="option"
              aria-selected={record._id === selectedId}
              onClick={() => {
                onSelect(record);
                setQuery("");
              }}
              className="grid w-full gap-0.5 px-3 py-2 text-left text-sm hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-medium text-ink">{record.name}</span>
              <span className="text-xs text-muted">
                {record.type}
                {record.address === undefined ? "" : ` · ${record.address}`}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 &&
        createName.length > 0 &&
        onCreate !== undefined ? (
          <li className="border-t border-line">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onCreate(createName)}
              className="w-full px-3 py-3 text-left text-sm font-semibold text-green-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create and link venue “{createName}”
            </button>
          </li>
        ) : matches.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted">No matching venue.</li>
        ) : null}
      </ul>
      <p className="text-xs text-muted">
        Linked records are the source of truth. The location label below is a
        saved snapshot or explicit display override.
      </p>
    </div>
  );
}
