import type { Metadata } from "next";
import { VenueReconciliationScreen } from "@/components/screens/venue-reconciliation-screen";

export const metadata: Metadata = {
  title: "Reconcile venue links · Race Planner",
};

export default function Page() {
  return <VenueReconciliationScreen />;
}
