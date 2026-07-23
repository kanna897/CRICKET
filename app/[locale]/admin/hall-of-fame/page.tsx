"use client";

import { HallOfFameDashboard } from "@/components/hall-of-fame-dashboard";
import { useAdminAccess } from "@/components/admin-shell";

export default function AdminHallOfFamePage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  return <main className="admin-themed-page"><HallOfFameDashboard admin organizerId={userId} isMasterAdmin={isMasterAdmin} /></main>;
}
