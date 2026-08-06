import type { Metadata } from "next";
import { WorkTemplatesScreen } from "@/components/screens/work-templates-screen";

export const metadata: Metadata = {
  title: "Checklist templates · Race Planner",
};

export default function Page() {
  return <WorkTemplatesScreen />;
}
