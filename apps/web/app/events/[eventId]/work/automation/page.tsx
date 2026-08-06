import type { Metadata } from "next";
import { WorkAutomationScreen } from "@/components/screens/work-automation-screen";

export const metadata: Metadata = {
  title: "Automation setup · Race Planner",
};

export default function Page() {
  return <WorkAutomationScreen />;
}
