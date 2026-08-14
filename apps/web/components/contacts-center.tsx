"use client";

import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
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
type ContactDraft = {
  id: string;
  title: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
};

function emptyContact(): ContactDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    name: "",
    email: "",
    phone: "",
    organization: "",
  };
}

function contactPayload(contact: ContactDraft) {
  return {
    title: contact.title,
    name: contact.name,
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    organization: contact.organization || undefined,
  };
}

function EventContactTable() {
  const { event, role } = useEventWorkspace();
  const overview = useQuery(logisticsApi.getOverview, { eventId: event.id });
  const createMany = useMutation(logisticsApi.createExternalContacts);
  const update = useMutation(logisticsApi.updateExternalContact);
  const remove = useMutation(logisticsApi.removeExternalContact);
  const canManage = role === "owner" || role === "manager";
  const [draft, setDraft] = useState<ContactDraft>(emptyContact);
  const [newRows, setNewRows] = useState<ContactDraft[]>([]);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const entryTitleRef = useRef<HTMLInputElement>(null);
  const setVisibleEntryTitleRef = (element: HTMLInputElement | null) => {
    if (element?.offsetParent !== null) entryTitleRef.current = element;
  };

  function resetEntry() {
    setDraft(emptyContact());
    setEditing(null);
    setNewRows([]);
  }

  function startAdd() {
    setEditing(null);
    setNewRows([emptyContact()]);
    setError(null);
    requestAnimationFrame(() => entryTitleRef.current?.focus());
  }

  function startEdit(contact: Contact) {
    setEditing(contact);
    setDraft({
      id: emptyContact().id,
      title: contact.title,
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      organization: contact.organization ?? "",
    });
    setError(null);
    requestAnimationFrame(() => entryTitleRef.current?.focus());
  }
  async function save(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await update({
          eventId: event.id,
          contactId: editing._id,
          ...contactPayload(draft),
        });
      } else
        await createMany({
          eventId: event.id,
          contacts: newRows.map(contactPayload),
        });
      resetEntry();
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
  const entryOpen = newRows.length > 0 || editing !== null;
  const entryLabel = editing ? "Edit event contact" : "Add event contacts";

  const updateNewRow = (
    id: string,
    key: Exclude<keyof ContactDraft, "id">,
    value: string,
  ) =>
    setNewRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );

  const addRow = () => {
    setNewRows((rows) => [...rows, emptyContact()]);
    requestAnimationFrame(() => entryTitleRef.current?.focus());
  };

  const removeNewRow = (id: string) => {
    setNewRows((rows) => rows.filter((row) => row.id !== id));
    setError(null);
  };

  const renderEntryRow = (key: string, row = draft, rowIndex?: number) => (
    <tr
      key={key}
      className="border-b border-line2 bg-soft/50 align-top last:border-0"
    >
      <td className="p-2">
        <Input
          ref={setVisibleEntryTitleRef}
          value={row.title}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, title: event.target.value })
              : updateNewRow(row.id, "title", event.target.value)
          }
          aria-label="Contact title"
          placeholder="Role or title"
          required
          disabled={saving}
        />
      </td>
      <td className="p-2">
        <div className="grid gap-2">
          <Input
            value={row.name}
            onChange={(event) =>
              rowIndex === undefined
                ? setDraft({ ...draft, name: event.target.value })
                : updateNewRow(row.id, "name", event.target.value)
            }
            aria-label="Contact name"
            placeholder="Full name"
            required
            disabled={saving}
          />
          <Input
            value={row.organization}
            onChange={(event) =>
              rowIndex === undefined
                ? setDraft({ ...draft, organization: event.target.value })
                : updateNewRow(row.id, "organization", event.target.value)
            }
            aria-label="Organization"
            placeholder="Organization (optional)"
            disabled={saving}
          />
        </div>
      </td>
      <td className="p-2">
        <Input
          type="email"
          value={row.email}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, email: event.target.value })
              : updateNewRow(row.id, "email", event.target.value)
          }
          aria-label="Contact email"
          placeholder="Email (optional)"
          disabled={saving}
        />
      </td>
      <td className="p-2">
        <Input
          type="tel"
          value={row.phone}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, phone: event.target.value })
              : updateNewRow(row.id, "phone", event.target.value)
          }
          aria-label="Contact phone"
          placeholder="Phone (optional)"
          disabled={saving}
        />
      </td>
      <td className="p-2">
        <div className="flex flex-wrap gap-1">
          {rowIndex === undefined ? (
            <>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetEntry}
                disabled={saving}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeNewRow(row.id)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove row {rowIndex + 1}</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderEntryCard = (key: string, row = draft, rowIndex?: number) => (
    <article
      key={key}
      className="grid gap-3 rounded-lg border border-line bg-soft/50 p-3"
    >
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Title
        <Input
          ref={setVisibleEntryTitleRef}
          value={row.title}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, title: event.target.value })
              : updateNewRow(row.id, "title", event.target.value)
          }
          aria-label="Contact title"
          placeholder="Role or title"
          required
          disabled={saving}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Name
        <Input
          value={row.name}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, name: event.target.value })
              : updateNewRow(row.id, "name", event.target.value)
          }
          aria-label="Contact name"
          placeholder="Full name"
          required
          disabled={saving}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Organization
        <Input
          value={row.organization}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, organization: event.target.value })
              : updateNewRow(row.id, "organization", event.target.value)
          }
          aria-label="Organization"
          placeholder="Organization (optional)"
          disabled={saving}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Email
        <Input
          type="email"
          value={row.email}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, email: event.target.value })
              : updateNewRow(row.id, "email", event.target.value)
          }
          aria-label="Contact email"
          placeholder="Email (optional)"
          disabled={saving}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Phone
        <Input
          type="tel"
          value={row.phone}
          onChange={(event) =>
            rowIndex === undefined
              ? setDraft({ ...draft, phone: event.target.value })
              : updateNewRow(row.id, "phone", event.target.value)
          }
          aria-label="Contact phone"
          placeholder="Phone (optional)"
          disabled={saving}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {rowIndex === undefined ? (
          <>
            <Button type="submit" size="sm" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetEntry}
              disabled={saving}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => removeNewRow(row.id)}
            disabled={saving}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove row{" "}
            {rowIndex + 1}
          </Button>
        )}
      </div>
    </article>
  );

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
          {canManage && !entryOpen ? (
            <Button type="button" size="sm" onClick={startAdd}>
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
          <form onSubmit={save} aria-label={entryLabel}>
            <div className="grid gap-3 xl:hidden">
              {overview.contacts.length === 0 &&
              newRows.length === 0 &&
              !editing ? (
                <p className="py-4 text-sm text-muted">
                  No event contacts have been recorded.
                </p>
              ) : null}
              {overview.contacts.map((contact) =>
                editing?._id === contact._id ? (
                  renderEntryCard(contact._id)
                ) : (
                  <article
                    key={contact._id}
                    className="grid gap-2 rounded-lg border border-line p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{contact.title}</p>
                      <p className="mt-1 font-medium text-ink">
                        {contact.name}
                      </p>
                      {contact.organization ? (
                        <p className="text-muted">{contact.organization}</p>
                      ) : null}
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
                      {contact.phone ? (
                        <a
                          className="inline-flex min-w-0 items-center gap-1 break-all text-green-ink underline"
                          href={`tel:${contact.phone}`}
                        >
                          <Phone className="h-4 w-4 shrink-0" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span>Phone: —</span>
                      )}
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(contact)}
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
                      </div>
                    ) : null}
                  </article>
                ),
              )}
              {canManage
                ? newRows.map((row, index) =>
                    renderEntryCard(row.id, row, index),
                  )
                : null}
            </div>
            <div className="hidden min-w-0 max-w-full overflow-x-auto xl:block">
              <table className="w-full min-w-[60rem] text-left text-sm">
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
                      <td
                        colSpan={canManage ? 5 : 4}
                        className="py-4 text-muted"
                      >
                        No event contacts have been recorded.
                      </td>
                    </tr>
                  ) : (
                    overview.contacts.map((contact) =>
                      editing?._id === contact._id ? (
                        renderEntryRow(contact._id)
                      ) : (
                        <tr
                          key={contact._id}
                          className="border-b border-line2 last:border-0"
                        >
                          <td className="py-3 pr-3">{contact.title}</td>
                          <td className="py-3 pr-3 font-medium text-ink">
                            {contact.name}
                            {contact.organization ? (
                              <span className="block text-xs font-normal text-muted">
                                {contact.organization}
                              </span>
                            ) : null}
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
                                  onClick={() => startEdit(contact)}
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
                      ),
                    )
                  )}
                  {canManage
                    ? newRows.map((row, index) =>
                        renderEntryRow(row.id, row, index),
                      )
                    : null}
                </tbody>
              </table>
            </div>
            {newRows.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={addRow}
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add row
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={saving}
                >
                  {saving
                    ? "Adding contacts…"
                    : `Add ${newRows.length} ${newRows.length === 1 ? "contact" : "contacts"}`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetEntry}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
          </form>
        )}
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
