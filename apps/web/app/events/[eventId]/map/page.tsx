import type { Metadata } from "next";
import { MapScreen } from "@/components/screens/map-screen";
export const metadata: Metadata = { title: "Map · Race Planner" };
export default function Page() {
  return <MapScreen />;
}
