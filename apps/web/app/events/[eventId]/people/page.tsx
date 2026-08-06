import type { Metadata } from "next";
import { PeopleScreen } from "@/components/screens/people-screen";

export const metadata: Metadata = {
  title: "People & permissions · Race Planner",
};

export default function Page() {
  return <PeopleScreen />;
}
