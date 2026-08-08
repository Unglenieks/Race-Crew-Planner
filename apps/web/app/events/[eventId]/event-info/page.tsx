import type { Metadata } from "next";
import { EventInfoScreen } from "@/components/screens/event-info-screen";
export const metadata: Metadata = { title: "Event info · Race Planner" };
export default function Page() {
  return <EventInfoScreen />;
}
