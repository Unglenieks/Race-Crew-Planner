"use client";

import { LoaderCircle, Mail, Phone, Send, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { invitationsApi, roleLabel, type EventContact } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDestructiveAction } from "@/components/ui/confirm-destructive-action";
import { useEventWorkspace } from "@/components/workspace/event-workspace";

type InvitationRole = "manager" | "crew" | "spectator";
const label = (contact: EventContact) =>
  contact.name || contact.email || contact.phoneNumber || "Profile pending";

export function EventContacts({ eventId }: { eventId: string }) {
  const { role: currentRole } = useEventWorkspace();
  const canManage = currentRole === "owner" || currentRole === "manager";
  const contacts = useQuery(invitationsApi.listContacts, { eventId });
  const revoke = useMutation(invitationsApi.revoke);
  const updateMemberRole = useMutation(invitationsApi.updateMemberRole);
  const removeMember = useMutation(invitationsApi.removeMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("crew");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    kind: "revoke" | "remove";
    id: string;
    label: string;
  } | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteStatus("Sending invitation…");
    setBusyId("invite");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      const response = await fetch("/api/event-invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, email, role }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Invitation failed");
      setEmail("");
      setRole("crew");
      setInviteStatus(
        response.status === 202
          ? "Invitation pending. This person can sign in to claim access."
          : "Invitation sent. It remains pending until claimed.",
      );
    } catch (reason) {
      setInviteStatus(null);
      setError(
        reason instanceof Error && reason.message !== "Invitation failed"
          ? reason.message
          : "We could not send this invitation. Check the email address and try again.",
      );
    } finally {
      setBusyId(null);
    }
  }
  async function changeRole(id: string, nextRole: InvitationRole) {
    setError(null);
    setBusyId(id);
    try {
      await updateMemberRole({ eventId, membershipId: id, role: nextRole });
    } catch {
      setError("We could not update this crew member's access.");
    } finally {
      setBusyId(null);
    }
  }
  async function confirm() {
    if (!confirmation) return;
    setError(null);
    setBusyId(confirmation.id);
    try {
      if (confirmation.kind === "revoke")
        await revoke({ eventId, invitationId: confirmation.id });
      else await removeMember({ eventId, membershipId: confirmation.id });
      setConfirmation(null);
    } catch {
      setError("We could not update this roster entry.");
    } finally {
      setBusyId(null);
    }
  }
  const contactStatus = (contact: EventContact) =>
    contact.type === "member"
      ? roleLabel(contact.role)
      : contact.status === "claimed"
        ? "Claimed"
        : contact.status === "expired"
          ? "Expired"
          : contact.status === "canceled"
            ? "Canceled"
            : "Pending";
  const renderRoleControl = (contact: EventContact) =>
    contact.type === "member" && canManage && contact.role !== "owner" ? (
      <select
        aria-label={`Role for ${label(contact)}`}
        value={contact.role}
        disabled={busyId === contact.id}
        onChange={(event) =>
          void changeRole(contact.id, event.target.value as InvitationRole)
        }
        className="min-h-9 rounded-md border border-line bg-card px-2 py-1 text-sm text-ink"
      >
        <option value="manager">Crew Chief</option>
        <option value="crew">Crew</option>
        <option value="spectator">Spectator</option>
      </select>
    ) : (
      contactStatus(contact)
    );
  const renderAction = (contact: EventContact) =>
    !canManage ||
    (contact.type === "member" && contact.role === "owner") ? null : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busyId === contact.id}
        onClick={() =>
          setConfirmation({
            kind:
              contact.type === "invitation" && contact.status === "pending"
                ? "revoke"
                : "remove",
            id: contact.id,
            label: label(contact),
          })
        }
      >
        <Trash2 className="h-4 w-4" />
        {contact.type === "invitation" ? "Cancel invitation" : "Remove"}
      </Button>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team & crew</CardTitle>
        <p className="mt-1 text-sm text-muted">
          The roster is updated automatically when an invitation is accepted.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {confirmation ? (
          <ConfirmDestructiveAction
            title={
              confirmation.kind === "revoke"
                ? "Cancel invitation?"
                : "Remove crew member?"
            }
            description={
              confirmation.kind === "revoke"
                ? `Cancel the invitation for ${confirmation.label}.`
                : `Remove ${confirmation.label} from this event.`
            }
            confirmLabel={
              confirmation.kind === "revoke"
                ? "Cancel invitation"
                : "Remove member"
            }
            isPending={busyId === confirmation.id}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => void confirm()}
          />
        ) : null}
        {contacts === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading crew…
          </p>
        ) : (
          <>
            <div className="grid gap-3 xl:hidden">
              {contacts.map((contact) => (
                <article
                  key={contact.id}
                  className="grid gap-2 rounded-lg border border-line p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{label(contact)}</p>
                    <div className="mt-1 text-muted">
                      {renderRoleControl(contact)}
                    </div>
                  </div>
                  <div className="grid gap-1 text-muted">
                    {contact.email ? (
                      <a
                        className="inline-flex min-w-0 items-center gap-1 break-all text-green-ink underline"
                        href={`mailto:${contact.email}`}
                      >
                        <Mail className="h-4 w-4 shrink-0" />
                        {contact.email}
                      </a>
                    ) : (
                      <span>Email: —</span>
                    )}
                    {contact.phoneNumber ? (
                      <a
                        className="inline-flex min-w-0 items-center gap-1 break-all text-green-ink underline"
                        href={`tel:${contact.phoneNumber}`}
                      >
                        <Phone className="h-4 w-4 shrink-0" />
                        {contact.phoneNumber}
                      </a>
                    ) : (
                      <span>Phone: —</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderAction(contact)}
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden min-w-0 max-w-full overflow-x-auto xl:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-2 pr-3">Title</th>
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Email</th>
                    <th className="pb-2 pr-3">Phone</th>
                    {canManage ? <th className="pb-2">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-line2 last:border-0"
                    >
                      <td className="py-3 pr-3">
                        {renderRoleControl(contact)}
                      </td>
                      <td className="py-3 pr-3 font-medium text-ink">
                        {label(contact)}
                      </td>
                      <td className="py-3 pr-3">
                        {contact.email ? (
                          <a
                            className="inline-flex items-center gap-1 text-green-ink underline"
                            href={`mailto:${contact.email}`}
                          >
                            <Mail className="h-4 w-4" />
                            {contact.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {contact.phoneNumber ? (
                          <a
                            className="inline-flex items-center gap-1 text-green-ink underline"
                            href={`tel:${contact.phoneNumber}`}
                          >
                            <Phone className="h-4 w-4" />
                            {contact.phoneNumber}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManage ? (
                        <td className="py-3">{renderAction(contact) ?? "—"}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {canManage ? (
          <form
            className="grid gap-3 border-t border-line pt-5 xl:grid-cols-[minmax(0,1fr)_12rem_auto]"
            onSubmit={invite}
          >
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">
                Email address
              </span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">Access level</span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as InvitationRole)
                }
                className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm text-ink"
              >
                <option value="crew">Crew</option>
                <option value="manager">Crew Chief</option>
                <option value="spectator">Spectator</option>
              </select>
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={busyId === "invite"}
              className="w-full self-end xl:w-auto"
            >
              {busyId === "invite" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Invite
            </Button>
          </form>
        ) : null}
        {inviteStatus ? (
          <p className="text-sm text-success-tx" role="status">
            {inviteStatus}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger-tx" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
