"use client";

import { BellRing, CheckCircle2, ClipboardList, Radio } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAttention } from "@/lib/use-attention";
import { screenHref } from "@/lib/screens";

export function AttentionQueue({ eventId }: { eventId: string }) {
  const { assignedWork, unacknowledged, count, isLoading } =
    useAttention(eventId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-green-ink">
              Action required
            </p>
            <CardTitle id="attention-heading" className="mt-1">
              Attention queue
            </CardTitle>
          </div>
          <span
            className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-ink px-2 text-xs font-bold text-paper"
            aria-label={`${count} items requiring attention`}
          >
            {isLoading ? "…" : count}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <p className="text-sm text-muted" role="status">
            Checking assigned work and plan changes…
          </p>
        ) : count === 0 ? (
          <div className="flex gap-3 rounded-lg border border-success-ln bg-success-bg p-4">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-success-tx"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-success-tx">
              You’re all caught up. New assigned work and plan changes appear
              here until they are resolved.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2" aria-live="polite">
            {unacknowledged.map(({ recipient, change }) => (
              <li
                key={recipient._id}
                className="flex gap-3 rounded-lg border border-warning-ln bg-warning-bg p-4"
              >
                <Radio
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning-tx"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-warning-tx">
                    Acknowledge {change.severity} plan change
                  </p>
                  <p className="mt-1 text-sm text-warning-tx">
                    {change.title}.{" "}
                    <Link
                      href={`/events/${eventId}/plan/${change.itineraryItemId}#published-changes`}
                      className="font-semibold underline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      Review and acknowledge
                    </Link>{" "}
                    on the affected movement.
                  </p>
                </div>
              </li>
            ))}
            {assignedWork.map((item) => (
              <li
                key={item._id}
                className="flex gap-3 rounded-lg border border-line bg-topbg p-4"
              >
                <ClipboardList
                  className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-ink">
                    Complete assigned work
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {item.title}
                    {item.dueContext === undefined
                      ? ""
                      : ` · ${item.dueContext}`}
                    .{" "}
                    <Link
                      href={screenHref(eventId, "work")}
                      className="font-semibold text-ink underline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      Open work
                    </Link>{" "}
                    to complete it.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="flex gap-2 border-t border-line pt-3 text-xs leading-relaxed text-muted">
          <BellRing
            className="h-4 w-4 shrink-0 text-green-ink"
            aria-hidden="true"
          />
          Resolve the related work or acknowledge the plan change to clear an
          item from this queue.
        </p>
      </CardContent>
    </Card>
  );
}
