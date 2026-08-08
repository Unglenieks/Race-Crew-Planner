import type { Metadata } from "next";
import { LogisticsScreen } from "@/components/screens/logistics-screen";

export const metadata: Metadata = { title: "Rally logistics · Race Planner" };

export default function Page() {
  return <LogisticsScreen />;
}
