import { Check, ClipboardList, Route, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventRole } from "@/lib/events-api";
import {
  getScreen,
  roleSatisfies,
  screenHref,
  type ScreenId,
} from "@/lib/screens";

const steps: Array<{
  title: string;
  description: string;
  screenId: ScreenId;
  icon: typeof Route;
}> = [
  {
    title: "Add the first movement",
    description:
      "Give the team its next time and place. You can add details later.",
    screenId: "plan",
    icon: Route,
  },
  {
    title: "Add your crew",
    description: "Invite people before sharing operational changes with them.",
    screenId: "people",
    icon: Users,
  },
  {
    title: "Review attention",
    description: "Assigned work and plan changes stay visible until resolved.",
    screenId: "attention",
    icon: ClipboardList,
  },
];

export function EventSetupGuide({
  eventId,
  eventName,
  role,
}: {
  eventId: string;
  eventName: string;
  role: EventRole;
}) {
  // Only offer steps this role can actually open, so the guide never points at
  // a screen that will refuse access. Roles come from the screen registry, not
  // a second copy of the rules.
  const availableSteps = steps.filter((step) =>
    roleSatisfies(role, getScreen(step.screenId).minRole),
  );

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
            {availableSteps.map(
              ({ title, description, screenId, icon: Icon }, index) => (
                <li key={title}>
                  <Link
                    href={screenHref(eventId, screenId)}
                    className="flex min-h-11 items-start gap-3 rounded-lg border border-success-ln bg-card p-3 text-left hover:border-green focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green text-xs font-bold text-lime">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                        {description}
                      </span>
                    </span>
                    <Icon
                      className="mt-1 h-4 w-4 shrink-0 text-green-ink"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ),
            )}
          </ol>
          <p className="mt-4 flex gap-2 border-t border-success-ln pt-3 text-xs leading-relaxed text-success-tx">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            You can return to these steps at any time. Nothing is shared until
            you save it.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
