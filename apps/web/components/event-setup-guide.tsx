"use client";

import { Check, Route, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  setupApi,
  type EventRole,
  type SetupStepStatus,
} from "@/lib/events-api";
import { screenHref } from "@/lib/screens";

const steps: Record<
  SetupStepStatus["id"],
  {
    title: string;
    description: string;
    screenId?: "plan" | "people";
    icon: typeof Route;
  }
> = {
  profile: {
    title: "Complete your profile",
    description: "Add a name and verified email from your account menu.",
    icon: UserRound,
  },
  movement: {
    title: "Add the first movement",
    description: "Give the team its next time and place.",
    screenId: "plan",
    icon: Route,
  },
  crew: {
    title: "Invite your crew",
    description: "Invite people before sharing operational changes.",
    screenId: "people",
    icon: Users,
  },
};

export function EventSetupGuide({
  eventId,
  eventName,
  role,
}: {
  eventId: string;
  eventName: string;
  role: EventRole;
}) {
  const status = useQuery(setupApi.status, { eventId });
  const dismiss = useMutation(setupApi.dismiss);
  if (role === "crew") return null;
  if (status === undefined) return null;
  const visible = status.filter((step) => !step.dismissed);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="setup-heading">
      <Card className="border-success-ln bg-success-bg">
        <CardHeader>
          <p className="font-mono text-[11px] uppercase tracking-wider text-success-tx">
            Getting started
          </p>
          <CardTitle id="setup-heading" className="mt-1">
            Set up {eventName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {visible.map((state) => {
              const step = steps[state.id];
              const Icon = step.icon;
              const content = (
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-green-ink"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {step.description}
                    </span>
                  </span>
                </span>
              );
              return (
                <li
                  key={state.id}
                  className="flex items-center gap-2 rounded-lg border border-success-ln bg-card p-3"
                >
                  {step.screenId && !state.completed ? (
                    <Link
                      className="flex min-w-0 flex-1 focus-visible:outline-3 focus-visible:outline-focus"
                      href={screenHref(eventId, step.screenId)}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {state.completed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-tx">
                      <Check className="h-4 w-4" aria-hidden="true" /> Done
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Dismiss ${step.title}`}
                    onClick={() => void dismiss({ eventId, step: state.id })}
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> Dismiss
                  </Button>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 border-t border-success-ln pt-3 text-xs text-success-tx">
            Steps are tracked independently; completing one never hides the
            others.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
