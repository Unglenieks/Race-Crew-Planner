import type { Metadata } from "next";
import { PlanPublishScreen } from "@/components/screens/plan-publish-screen";

export const metadata: Metadata = { title: "Publish change · Race Planner" };

export default function Page() {
  return <PlanPublishScreen />;
}
