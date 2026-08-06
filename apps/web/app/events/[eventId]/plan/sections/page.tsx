import type { Metadata } from "next";
import { PlanSectionsScreen } from "@/components/screens/plan-sections-screen";

export const metadata: Metadata = { title: "Plan sections · Race Planner" };

export default function Page() {
  return <PlanSectionsScreen />;
}
