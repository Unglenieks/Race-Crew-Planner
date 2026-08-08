export type InvitationClaimResult = {
  claimedCount: number;
  requiresVerifiedEmail: boolean;
};

export async function claimAuthenticatedInvitations() {
  const response = await fetch("/api/event-invitations/claim", {
    method: "POST",
  });
  if (!response.ok) throw new Error("Invitation claim failed");
  return (await response.json()) as InvitationClaimResult;
}
