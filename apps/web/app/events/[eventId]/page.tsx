import { redirect } from "next/navigation";
import { defaultScreenId, screenHref } from "@/lib/screens";

export default async function EventIndexPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  redirect(screenHref(eventId, defaultScreenId));
}
