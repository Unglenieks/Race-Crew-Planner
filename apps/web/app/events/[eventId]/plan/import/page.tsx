import type { Metadata } from "next";
import { PlanImportScreen } from "@/components/screens/plan-import-screen";

export const metadata: Metadata = { title: "Import plan · Race Planner" };

export default function Page() {
  return <PlanImportScreen />;
}
