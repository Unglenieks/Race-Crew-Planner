import type { Metadata } from "next";
import { MovementDetailScreen } from "@/components/screens/movement-detail-screen";

export const metadata: Metadata = { title: "Movement detail · Race Planner" };

export default async function Page({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return <MovementDetailScreen itemId={itemId} />;
}
