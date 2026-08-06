"use client";

import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { planSectionsApi } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PlanSections({
  eventId,
  role,
}: {
  eventId: string;
  role: "owner" | "manager" | "crew";
}) {
  const sections = useQuery(planSectionsApi.list, { eventId });
  const create = useMutation(planSectionsApi.create);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"day" | "session" | "leg">("day");
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan sections</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {role === "crew" ? null : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              await create({ eventId, name, kind });
              setName("");
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Friday service"
              maxLength={120}
              required
              className="flex-1"
            />
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              className="min-h-11 rounded-lg border border-line px-3 text-sm"
            >
              <option value="day">Day</option>
              <option value="session">Session</option>
              <option value="leg">Leg</option>
            </select>
            <Button type="submit" variant="secondary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-2" aria-label="Plan section filter">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`rounded-full border px-3 py-2 text-sm ${selected === null ? "border-green bg-soft" : "border-line"}`}
          >
            All movements
          </button>
          {sections?.map((section) => (
            <button
              key={section._id}
              type="button"
              onClick={() => setSelected(section._id)}
              className={`rounded-full border px-3 py-2 text-sm ${selected === section._id ? "border-green bg-soft" : "border-line"}`}
            >
              {section.kind}: {section.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Selected section:{" "}
          {selected === null
            ? "All movements"
            : sections?.find((section) => section._id === selected)?.name}
          . Assignment controls follow with the itinerary editor migration.
        </p>
      </CardContent>
    </Card>
  );
}
