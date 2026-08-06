"use client";

import { BellRing, CheckCircle2, ClipboardList, Radio } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkItem = {
  _id: string;
  title: string;
  status: "open" | "completed";
  assigneeId?: string;
  dueContext?: string;
};
type Recipient = {
  state: "sent" | "opened" | "acknowledged" | "acknowledgedElsewhere";
};
type ChangeForMe = {
  recipient: Recipient;
  change: {
    _id: string;
    title: string;
    severity: "routine" | "critical";
  } | null;
};

const workApi = makeFunctionReference<"query", { eventId: string }, WorkItem[]>(
  "work:list",
);
const planChangesApi = makeFunctionReference<
  "query",
  { eventId: string },
  ChangeForMe[]
>("planChanges:listForMe");

export function AttentionQueue({ eventId }: { eventId: string }) {
  const { userId } = useAuth();
  const work = useQuery(workApi, { eventId });
  const changes = useQuery(planChangesApi, { eventId });
  const assignedWork = (work ?? []).filter(
    (item) => item.status === "open" && item.assigneeId === userId,
  );
  const unacknowledged = (changes ?? []).filter(
    (item) =>
      item.change !== null &&
      item.recipient.state !== "acknowledged" &&
      item.recipient.state !== "acknowledgedElsewhere",
  );
  const loading = work === undefined || changes === undefined;
  const attentionCount = assignedWork.length + unacknowledged.length;

  return (
    <section
      id="attention"
      aria-labelledby="attention-heading"
      className="scroll-mt-24"
    >
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
              aria-label={`${attentionCount} items requiring attention`}
            >
              {loading ? "…" : attentionCount}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted" role="status">
              Checking assigned work and plan changes…
            </p>
          ) : attentionCount === 0 ? (
            <div className="flex gap-3 rounded-lg border border-success-ln bg-soft p-4">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                aria-hidden="true"
              />
              <p className="text-sm leading-relaxed text-green-ink">
                Nothing needs your action right now. New assigned work and plan
                changes remain here until you resolve them.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2" aria-live="polite">
              {unacknowledged.map(({ change }) =>
                change === null ? null : (
                  <li
                    key={change._id}
                    className="flex gap-3 rounded-lg border border-warning-ln bg-warning-bg p-4"
                  >
                    <Radio
                      className="mt-0.5 h-5 w-5 shrink-0 text-warning-tx"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-ink">
                        Acknowledge {change.severity} plan change
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {change.title}. Open Plan to review the instruction and
                        acknowledge it.
                      </p>
                    </div>
                  </li>
                ),
              )}
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
                      . Open Work to complete it.
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
            Items leave this queue only when you resolve them. This release does
            not automatically clear or snooze attention.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
