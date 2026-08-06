import type { Metadata } from "next";
import { WorkScreen } from "@/components/screens/work-screen";

export const metadata: Metadata = { title: "Work & checklists · Race Planner" };

export default function Page() {
  return <WorkScreen />;
}
