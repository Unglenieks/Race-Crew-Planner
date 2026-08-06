import type { Metadata } from "next";
import { RecordsScreen } from "@/components/screens/records-screen";

export const metadata: Metadata = { title: "Records & venues · Race Planner" };

export default function Page() {
  return <RecordsScreen />;
}
