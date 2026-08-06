import type { Metadata } from "next";
import { FormsScreen } from "@/components/screens/forms-screen";

export const metadata: Metadata = {
  title: "Forms & inspections · Race Planner",
};

export default function Page() {
  return <FormsScreen />;
}
