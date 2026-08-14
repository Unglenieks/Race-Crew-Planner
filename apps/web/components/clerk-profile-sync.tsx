"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { invitationsApi } from "@/lib/events-api";

/** Reconciles Clerk account-profile edits, including verified phone changes. */
export function ClerkProfileSync() {
  const { isLoaded, user } = useUser();
  const syncProfile = useMutation(invitationsApi.syncProfile);
  const userId = user?.id;
  const updatedAt = user?.updatedAt?.getTime();

  useEffect(() => {
    if (!isLoaded || userId === undefined) return;
    void syncProfile().catch(() => undefined);
  }, [isLoaded, syncProfile, updatedAt, userId]);

  return null;
}
