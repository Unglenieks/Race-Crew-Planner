import type { Metadata } from "next";
import { AttentionScreen } from "@/components/screens/attention-screen";

export const metadata: Metadata = { title: "Attention · Race Planner" };

export default function Page() {
  return <AttentionScreen />;
}
