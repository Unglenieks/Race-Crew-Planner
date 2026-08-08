"use client";

import { Check, ChevronLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { itineraryApi, type EventRole } from "@/lib/events-api";

type Approval = { itemId: string; recordId: string };

/** Human-reviewed reconciliation for imported or legacy movements with no record link. */
export function VenueReconciliation({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const movements = useQuery(itineraryApi.listUnlinked, { eventId });
  const reconcile = useMutation(itineraryApi.reconcileLinks);
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const canEdit = role === "owner" || role === "manager";
  const selected = useMemo<Approval[]>(
    () =>
      Object.entries(approvals).map(([itemId, recordId]) => ({
        itemId,
        recordId,
      })),
    [approvals],
  );

  function choose(itemId: string, recordId: string) {
    setApprovals((current) => ({ ...current, [itemId]: recordId }));
  }

  async function approveSelected() {
    if (selected.length === 0) return;
    setError(null);
    setIsSaving(true);
    try {
      await reconcile({ eventId, links: selected });
      setSaved(selected.map((link) => link.itemId));
      setApprovals({});
    } catch {
      setError(
        "The selected links were not saved. Refresh and review them again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="mx-auto grid max-w-4xl gap-4"
      aria-labelledby="venue-reconciliation-heading"
    >
      <div>
        <Link
          href={`/events/${eventId}/plan`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-green-ink underline-offset-4 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Movement plan
        </Link>
        <h1
          id="venue-reconciliation-heading"
          className="mt-3 font-serif text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-ink"
        >
          Reconcile venue links
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          Review imported place labels against venue records. Matches are
          suggestions only; ambiguous names are never linked automatically.
        </p>
      </div>
      {error === null ? null : (
        <Banner
          variant="danger"
          label="Venue reconciliation failed"
          role="alert"
        >
          {error}
        </Banner>
      )}
      {saved.length === 0 ? null : (
        <Banner variant="success" label="Venue links saved" role="status">
          {saved.length} movement{saved.length === 1 ? "" : "s"} linked. Review
          each affected movement to publish an operational change when needed.
        </Banner>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Unlinked movements</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Select a specific suggested venue for each movement, then
                approve several at once.
              </p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                disabled={selected.length === 0 || isSaving}
                onClick={() => void approveSelected()}
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Approve {selected.length || "selected"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {movements === undefined ? (
            <p
              className="flex items-center gap-2 text-sm text-muted"
              role="status"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading unlinked
              movements…
            </p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted">
              Every active movement with a place label is linked to a venue
              record.
            </p>
          ) : (
            <ol className="grid gap-5">
              {movements.map((movement) => (
                <li
                  key={movement.itemId}
                  className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0"
                >
                  <div>
                    <Link
                      href={`/events/${eventId}/plan/${movement.itemId}`}
                      className="font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {movement.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      Original label: {movement.location ?? "Not recorded"}
                    </p>
                  </div>
                  {movement.candidates.length === 0 ? (
                    <p className="rounded-md bg-topbg px-3 py-2 text-sm text-muted">
                      {movement.location === undefined
                        ? "No location label was recorded. Open the movement to choose a venue."
                        : "No venue suggestions. Create a venue from the movement plan, then return to link it here."}
                    </p>
                  ) : (
                    <fieldset
                      className="grid gap-2"
                      disabled={!canEdit || isSaving}
                    >
                      <legend className="text-sm font-medium text-ink">
                        Suggested venues
                      </legend>
                      {movement.candidates.map((candidate) => (
                        <label
                          key={candidate.recordId}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 text-sm has-[:checked]:border-success-ln has-[:checked]:bg-success-bg"
                        >
                          <input
                            type="radio"
                            name={movement.itemId}
                            checked={
                              approvals[movement.itemId] === candidate.recordId
                            }
                            onChange={() =>
                              choose(movement.itemId, candidate.recordId)
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-ink">
                              {candidate.name}
                            </span>
                            <span className="block text-xs text-muted">
                              {candidate.type}
                              {candidate.address === undefined
                                ? ""
                                : ` · ${candidate.address}`}
                            </span>
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {candidate.match}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
