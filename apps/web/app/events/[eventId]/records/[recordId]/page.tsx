import { RecordDetail } from "@/components/records-operational";
export const metadata = { title: "Record detail · Race Planner" };
export default async function Page({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  return <RecordDetail recordId={recordId} />;
}
