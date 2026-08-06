import type { Metadata } from "next";
import { TodayScreen } from "@/components/screens/today-screen";

export const metadata: Metadata = { title: "Today · Race Planner" };

export default function Page() {
  return <TodayScreen />;
}
