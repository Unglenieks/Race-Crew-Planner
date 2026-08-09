"use client";

import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Tabs, TabsContent, TabsList, TabTrigger } from "@/components/ui/tabs";
import { EventContacts } from "@/components/event-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDestructiveAction } from "@/components/ui/confirm-destructive-action";
import { Input } from "@/components/ui/input";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { logisticsApi, type LogisticsOverview } from "@/lib/events-api";

type Contact = LogisticsOverview["contacts"][number];
const empty = { title: "", name: "", email: "", phone: "", organization: "" };

function EventContactTable() {
  const { event, role } = useEventWorkspace();
  const overview = useQuery(logisticsApi.getOverview, { eventId: event.id });
  const create = useMutation(logisticsApi.createExternalContact);
  const update = useMutation(logisticsApi.updateExternalContact);
  const remove = useMutation(logisticsApi.removeExternalContact);
  const canManage = role === "owner" || role === "manager";
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function start(contact?: Contact) {
    setEditing(contact ?? null);
    setDraft(
      contact
        ? {
            title: contact.title,
            name: contact.name,
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            organization: contact.organization ?? "",
          }
        : empty,
    );
    setError(null);
  }
  async function save(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing)
        await update({
          eventId: event.id,
          contactId: editing._id,
          ...draft,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
          organization: draft.organization || undefined,
        });
      else
        await create({
          eventId: event.id,
          ...draft,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
          organization: draft.organization || undefined,
        });
      setEditing(null);
      setDraft(empty);
    } catch {
      setError("We could not save this event contact.");
    } finally {
      setSaving(false);
    }
  }
  async function confirmRemove() {
    if (!removing) return;
    try {
      await remove({ eventId: event.id, contactId: removing._id });
      setRemoving(null);
    } catch {
      setError("We could not remove this event contact.");
    }
  }
  const editOpen = editing !== null || draft !== empty;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Event contacts</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Officials, organisers, and support contacts for this event.
            </p>
          </div>
          {canManage ? (
            <Button type="button" size="sm" onClick={() => start()}>
              <Plus className="h-4 w-4" />
              Add contact
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {removing ? (
          <ConfirmDestructiveAction
            title="Remove event contact?"
            description={`Remove ${removing.name} from this event's contact list.`}
            confirmLabel="Remove contact"
            onCancel={() => setRemoving(null)}
            onConfirm={() => void confirmRemove()}
          />
        ) : null}
        {overview === undefined ? (
          <p className="text-sm text-muted">Loading contacts…</p>
        ) : (
          <div className="overflow-x-auto">
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
                {overview.contacts.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="py-4 text-muted">
                      No event contacts have been recorded.
                    </td>
                  </tr>
                ) : (
                  overview.contacts.map((contact) => (
                    <tr
                      key={contact._id}
                      className="border-b border-line2 last:border-0"
                    >
                      <td className="py-3 pr-3">{contact.title}</td>
                      <td className="py-3 pr-3 font-medium text-ink">
                        {contact.name}
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
                        {contact.phone ? (
                          <a
                            className="inline-flex items-center gap-1 text-green-ink underline"
                            href={`tel:${contact.phone}`}
                          >
                            <Phone className="h-4 w-4" />
                            {contact.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManage ? (
                        <td className="py-3">
                          <span className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => start(contact)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoving(contact)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {canManage && editOpen ? (
          <form
            className="grid gap-3 border-t border-line pt-4 md:grid-cols-2"
            onSubmit={save}
          >
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Title</span>
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Phone</span>
              <Input
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: event.target.value })
                }
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save contact"
                    : "Create contact"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setDraft(empty);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
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

export function ContactsCenter() {
  const { event } = useEventWorkspace();
  return (
    <Tabs defaultValue="event">
      <TabsList aria-label="Contact groups">
        <TabTrigger value="event">Event contacts</TabTrigger>
        <TabTrigger value="team">Team & crew</TabTrigger>
      </TabsList>
      <TabsContent value="event" className="mt-4">
        <EventContactTable />
      </TabsContent>
      <TabsContent value="team" className="mt-4">
        <EventContacts eventId={event.id} />
      </TabsContent>
    </Tabs>
  );
}
