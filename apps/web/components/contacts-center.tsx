"use client";

import { Mail, Phone } from "lucide-react";
import { useQuery } from "convex/react";
import { Tabs, TabsContent, TabsList, TabTrigger } from "@/components/ui/tabs";
import { EventContacts } from "@/components/event-contacts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventWorkspace } from "@/components/workspace/event-workspace";
import { logisticsApi } from "@/lib/events-api";

export function ContactsCenter() {
  const { event } = useEventWorkspace();
  const overview = useQuery(logisticsApi.getOverview, { eventId: event.id });
  return (
    <Tabs defaultValue="event">
      <TabsList aria-label="Contact groups">
        <TabTrigger value="event">Event contacts</TabTrigger>
        <TabTrigger value="team">Team & crew</TabTrigger>
      </TabsList>
      <TabsContent value="event" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Event contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {overview === undefined ? (
              <p className="text-sm text-muted">Loading contacts…</p>
            ) : overview.contacts.length === 0 ? (
              <p className="text-sm text-muted">
                No event contacts have been recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="pb-2 pr-3">Role</th>
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.contacts.map((contact) => (
                      <tr
                        key={contact._id}
                        className="border-b border-line2 last:border-0"
                      >
                        <td className="py-3 pr-3 font-medium text-ink">
                          {contact.title}
                        </td>
                        <td className="py-3 pr-3">{contact.name}</td>
                        <td className="py-3">
                          <span className="flex flex-wrap gap-3">
                            {contact.email ? (
                              <a
                                className="inline-flex items-center gap-1 text-green-ink underline"
                                href={`mailto:${contact.email}`}
                              >
                                <Mail className="h-4 w-4" />
                                Email
                              </a>
                            ) : null}
                            {contact.phone ? (
                              <a
                                className="inline-flex items-center gap-1 text-green-ink underline"
                                href={`tel:${contact.phone}`}
                              >
                                <Phone className="h-4 w-4" />
                                {contact.phone}
                              </a>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="team" className="mt-4">
        <EventContacts eventId={event.id} />
      </TabsContent>
    </Tabs>
  );
}
