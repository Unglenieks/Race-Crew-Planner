import type { Metadata } from "next";
import { FilesScreen } from "@/components/screens/files-screen";

export const metadata: Metadata = { title: "Files & sources · Race Planner" };

export default function Page() {
  return <FilesScreen />;
}
