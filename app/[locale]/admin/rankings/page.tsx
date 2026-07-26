"use client";

import { useAdminAccess } from "@/components/admin-shell";
import { TournamentRankingsDashboard } from "@/components/tournament-rankings-dashboard";

export default function AdminRankingsPage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  return <main className="admin-themed-page"><TournamentRankingsDashboard admin organizerId={userId} isMasterAdmin={isMasterAdmin}/></main>;
}
