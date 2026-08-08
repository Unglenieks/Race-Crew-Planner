"use client";

import { LoaderCircle, Send, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { invitationsApi, type EventContact } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDestructiveAction } from "@/components/ui/confirm-destructive-action";

type InvitationRole = "manager" | "crew";

function contactLabel(contact: EventContact) {
  return (
    contact.name || contact.email || contact.phoneNumber || "Profile pending"
  );
}

export function EventContacts({ eventId }: { eventId: string }) {
  const contacts = useQuery(invitationsApi.listContacts, { eventId });
  const revoke = useMutation(invitationsApi.revoke);
  const updateMemberRole = useMutation(invitationsApi.updateMemberRole);
  const removeMember = useMutation(invitationsApi.removeMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("crew");
  const [query, setQuery] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    kind: "revoke" | "remove";
    id: string;
    label: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === "" || contacts === undefined) return [];
    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.phoneNumber].some((value) =>
        value?.toLowerCase().includes(normalized),
      ),
    );
  }, [contacts, query]);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsInviting(true);
    try {
      const response = await fetch("/api/event-invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, email, role }),
      });
      if (!response.ok) throw new Error("Invitation failed");
      setEmail("");
      setRole("crew");
    } catch {
      setError(
        "We could not send this invitation. Check the email address and try again.",
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function onRevoke(invitationId: string) {
    setError(null);
    setBusyId(invitationId);
    try {
      await revoke({ eventId, invitationId });
      setMessage("The invitation was cancelled.");
      setConfirmation(null);
    } catch {
      setError("We could not cancel this invitation. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateRole(id: string, role: InvitationRole) {
    setError(null);
    setBusyId(id);
    try {
      await updateMemberRole({ eventId, membershipId: id, role });
    } catch {
      setError("We could not update this person's access.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await removeMember({ eventId, membershipId: id });
      setMessage("The member no longer has access to this event.");
      setConfirmation(null);
    } catch {
      setError("We could not remove this person's access.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Team contacts</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Search people already connected to this event, or send a Clerk email
            invitation.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {confirmation === null ? null : (
          <ConfirmDestructiveAction
            title={
              confirmation.kind === "revoke"
                ? "Cancel invitation?"
                : "Remove member?"
            }
            description={
              confirmation.kind === "revoke"
                ? `Cancel the invitation for ${confirmation.label}. They will need a new invitation to join this event.`
                : `Remove ${confirmation.label} from this event. They will lose access to its plan and operational data.`
            }
            confirmLabel={
              confirmation.kind === "revoke"
                ? "Cancel invitation"
                : "Remove member"
            }
            isPending={busyId === confirmation.id}
            onCancel={() => setConfirmation(null)}
            onConfirm={() =>
              void (confirmation.kind === "revoke"
                ? onRevoke(confirmation.id)
                : remove(confirmation.id))
            }
          />
        )}
        {message === null ? null : (
          <p className="text-sm text-success-tx" role="status">
            {message}
          </p>
        )}
        <div className="grid gap-1.5">
          <label
            className="text-sm font-medium text-ink"
            htmlFor="contact-search"
          >
            Search existing contacts
          </label>
          <Input
            id="contact-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, or phone"
            autoComplete="off"
          />
          {query.trim() !== "" && matches.length === 0 ? (
            <p className="text-sm text-muted">No matching contacts.</p>
          ) : matches.length === 0 ? null : (
            <ul className="rounded-lg border border-line">
              {matches.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between gap-3 border-b border-line p-3 last:border-0"
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {contactLabel(contact)}
                    </span>
                    <span className="block text-xs text-muted">
                      {contact.email || contact.phoneNumber}
                    </span>
                  </span>
                  <Badge
                    variant={contact.type === "member" ? "success" : "neutral"}
                  >
                    {contact.type === "member" ? contact.role : "Invited"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {contacts === undefined ? (
          <div className="flex items-center text-sm text-muted" role="status">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Loading contacts…
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {contactLabel(contact)}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {contact.email || contact.phoneNumber || "Profile pending"}
                  </span>
                </span>
                {contact.type === "member" && contact.role !== "owner" ? (
                  <select
                    aria-label={`Role for ${contactLabel(contact)}`}
                    value={contact.role}
                    disabled={busyId === contact.id}
                    onChange={(event) =>
                      void updateRole(
                        contact.id,
                        event.target.value as InvitationRole,
                      )
                    }
                    className="rounded-md border border-line bg-card px-2 py-1 text-sm text-ink"
                  >
                    <option value="manager">Manager</option>
                    <option value="crew">Crew</option>
                  </select>
                ) : (
                  <Badge
                    variant={contact.type === "member" ? "success" : "neutral"}
                  >
                    {contact.type === "member" ? contact.role : "Pending"}
                  </Badge>
                )}
                {contact.type === "invitation" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === contact.id}
                    onClick={() =>
                      setConfirmation({
                        kind: "revoke",
                        id: contact.id,
                        label: contactLabel(contact),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel
                  </Button>
                ) : contact.role === "owner" ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === contact.id}
                    onClick={() =>
                      setConfirmation({
                        kind: "remove",
                        id: contact.id,
                        label: contactLabel(contact),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-4 border-t border-line pt-5"
          onSubmit={onInvite}
        >
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-ink"
              htmlFor="invite-email"
            >
              Email address
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="teammate@example.com"
            />
          </div>
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-ink"
              htmlFor="invite-role"
            >
              Access level
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as InvitationRole)
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
            disabled={isInviting}
            className="w-fit"
          >
            {isInviting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
