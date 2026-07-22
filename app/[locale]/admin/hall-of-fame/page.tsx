"use client";

import { HallOfFameDashboard } from "@/components/hall-of-fame-dashboard";
import { useAdminAccess } from "@/components/admin-shell";

export default function AdminHallOfFamePage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  return <HallOfFameDashboard admin organizerId={userId} isMasterAdmin={isMasterAdmin} />;
}
