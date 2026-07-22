import { PublicNav } from "@/components/public-nav";
import { TournamentStatisticsDashboard } from "@/components/tournament-statistics-dashboard";
import { StatsMatchAnalytics } from "@/components/stats-match-analytics";

export default function PublicStatsPage() {
  return <><PublicNav /><main className="p-4 py-7 sm:p-7"><TournamentStatisticsDashboard /><StatsMatchAnalytics /></main></>;
}
