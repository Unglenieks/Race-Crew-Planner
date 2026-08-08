import { OfflineScreen } from "@/components/screens/offline-screen";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline manager · Race Planner" };

export default function Page() {
  return <OfflineScreen />;
}
