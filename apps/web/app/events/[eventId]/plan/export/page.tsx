import type { Metadata } from "next";
import { PlanExportScreen } from "@/components/screens/plan-export-screen";

export const metadata: Metadata = { title: "Export & print · Race Planner" };

export default function Page() {
  return <PlanExportScreen />;
}
