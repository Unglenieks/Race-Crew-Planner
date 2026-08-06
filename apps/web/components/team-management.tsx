"use client";

import { LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { membershipsApi, type EventMember } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AssignableRole = "manager" | "crew";

export function TeamManagement({ eventId }: { eventId: string }) {
  const members = useQuery(membershipsApi.list, { eventId });
  const addMember = useMutation(membershipsApi.add);
  const updateRole = useMutation(membershipsApi.updateRole);
  const removeMember = useMutation(membershipsApi.remove);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AssignableRole>("crew");
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAdding(true);

    try {
      await addMember({ eventId, userId, role });
      setUserId("");
      setRole("crew");
    } catch {
      setError(
        "We could not add this person. Check their member ID and try again.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function onRoleChange(member: EventMember, nextRole: AssignableRole) {
    setError(null);
    setBusyMemberId(member.id);

    try {
      await updateRole({ eventId, membershipId: member.id, role: nextRole });
    } catch {
      setError("We could not update this person’s access. Please try again.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function onRemove(member: EventMember) {
    setError(null);
    setBusyMemberId(member.id);

    try {
      await removeMember({ eventId, membershipId: member.id });
    } catch {
      setError("We could not remove this person’s access. Please try again.");
    } finally {
      setBusyMemberId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Team access</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Add people by their account member ID, then choose what they can do.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {members === undefined ? (
          <div
            className="flex min-h-16 items-center text-sm text-muted"
            role="status"
          >
            <LoaderCircle
              className="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Loading team access…
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              const isBusy = busyMemberId === member.id;

              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
                    {member.userId}
                  </span>
                  {isOwner ? (
                    <Badge variant="success">Owner</Badge>
                  ) : (
                    <select
                      aria-label={`Role for ${member.userId}`}
                      value={member.role}
                      disabled={isBusy}
                      onChange={(event) =>
                        void onRoleChange(
                          member,
                          event.target.value as AssignableRole,
                        )
                      }
                      className="rounded-md border border-line bg-card px-2 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="manager">Manager</option>
                      <option value="crew">Crew</option>
                    </select>
                  )}
                  {isOwner ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void onRemove(member)}
                      aria-label={`Remove ${member.userId}`}
                    >
                      {isBusy ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form className="grid gap-4 border-t border-line pt-5" onSubmit={onAdd}>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="member-id">
              Account member ID
            </label>
            <Input
              id="member-id"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              maxLength={191}
              required
              autoComplete="off"
              placeholder="e.g. user_2abc..."
            />
          </div>
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-ink"
              htmlFor="member-role"
            >
              Access level
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as AssignableRole)
              }
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
            >
              <option value="crew">Crew — can view the plan</option>
              <option value="manager">Manager — can edit the plan</option>
            </select>
          </div>
          {error === null ? null : (
            <p
              className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isAdding}
            className="w-fit"
          >
            {isAdding ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Add person
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
