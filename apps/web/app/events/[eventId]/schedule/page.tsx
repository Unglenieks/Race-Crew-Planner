import type { Metadata } from "next";
import { ScheduleScreen } from "@/components/screens/schedule-screen";
export const metadata: Metadata = { title: "Schedule · Race Planner" };
export default function Page() {
  return <ScheduleScreen />;
}
