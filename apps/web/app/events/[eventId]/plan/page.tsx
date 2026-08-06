import type { Metadata } from "next";
import { PlanScreen } from "@/components/screens/plan-screen";

export const metadata: Metadata = { title: "Movement plan · Race Planner" };

export default function Page() {
  return <PlanScreen />;
}
