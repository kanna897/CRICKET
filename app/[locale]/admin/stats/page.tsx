"use client";

import { TournamentStatisticsDashboard } from "@/components/tournament-statistics-dashboard";
import { StatsMatchAnalytics } from "@/components/stats-match-analytics";
import { useAdminAccess } from "@/components/admin-shell";

export default function AdminStatsPage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  return <main className="admin-themed-page space-y-10"><TournamentStatisticsDashboard admin organizerId={userId} isMasterAdmin={isMasterAdmin} /><StatsMatchAnalytics /></main>;
}
