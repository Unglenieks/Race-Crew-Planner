import type { Metadata } from "next";
import { ActivityScreen } from "@/components/screens/activity-screen";

export const metadata: Metadata = {
  title: "Activity & comments · Race Planner",
};

export default function Page() {
  return <ActivityScreen />;
}
