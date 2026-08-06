import type { Metadata } from "next";
import { WorkItemDetailScreen } from "@/components/screens/work-item-detail-screen";

export const metadata: Metadata = { title: "Work item detail · Race Planner" };

export default async function Page({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return <WorkItemDetailScreen itemId={itemId} />;
}
