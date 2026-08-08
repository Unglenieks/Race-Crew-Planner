import type { Metadata } from "next";
import { ContactsScreen } from "@/components/screens/contacts-screen";
export const metadata: Metadata = { title: "Contacts · Race Planner" };
export default function Page() {
  return <ContactsScreen />;
}
