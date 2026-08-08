import type { Metadata } from "next";
import { SpectatorInfoScreen } from "@/components/screens/spectator-info-screen";
export const metadata: Metadata = { title: "Spectator info · Race Planner" };
export default function Page() {
  return <SpectatorInfoScreen />;
}
