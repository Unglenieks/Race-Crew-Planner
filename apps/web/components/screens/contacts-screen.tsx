"use client";

import { ContactsCenter } from "@/components/contacts-center";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

export function ContactsScreen() {
  return (
    <WorkspaceScreen id="contacts">
      <ContactsCenter />
    </WorkspaceScreen>
  );
}
