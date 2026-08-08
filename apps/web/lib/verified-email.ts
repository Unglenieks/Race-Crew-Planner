type ClerkEmailAddress = {
  id: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

export function verifiedPrimaryEmail(user: {
  primaryEmailAddressId?: string | null;
  emailAddresses: ClerkEmailAddress[];
}) {
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  return primary?.verification?.status === "verified"
    ? primary.emailAddress.trim().toLowerCase()
    : undefined;
}
