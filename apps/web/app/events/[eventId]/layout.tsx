import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default async function EventWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return <WorkspaceShell eventId={eventId}>{children}</WorkspaceShell>;
}
