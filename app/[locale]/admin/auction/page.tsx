"use client";

import { useAdminAccess } from "@/components/admin-shell";
import { LiveAuctionDashboard } from "@/components/live-auction-dashboard";

export default function AdminAuctionPage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  return <LiveAuctionDashboard admin userId={userId} isMasterAdmin={isMasterAdmin} />;
}
