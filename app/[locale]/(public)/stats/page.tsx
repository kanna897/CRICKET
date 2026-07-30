import { PublicNav } from "@/components/public-nav";
import dynamic from "next/dynamic";

const TournamentStatisticsDashboard = dynamic(
  () => import("@/components/tournament-statistics-dashboard").then((module) => module.TournamentStatisticsDashboard),
  { loading: LoadingPanel },
);
const StatsMatchAnalytics = dynamic(
  () => import("@/components/stats-match-analytics").then((module) => module.StatsMatchAnalytics),
  { loading: LoadingPanel },
);

export default function PublicStatsPage() {
  return <><PublicNav /><main className="p-4 py-7 sm:p-7"><TournamentStatisticsDashboard /><StatsMatchAnalytics /></main></>;
}

function LoadingPanel() {
  return <div role="status" className="grid min-h-64 place-items-center text-muted-foreground">Loading statistics…</div>;
}
