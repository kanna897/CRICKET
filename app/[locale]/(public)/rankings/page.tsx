import { PublicNav } from "@/components/public-nav";
import { TournamentRankingsDashboard } from "@/components/tournament-rankings-dashboard";

export default function PublicRankingsPage() {
  return <><PublicNav/><main className="p-4 py-7 sm:p-7"><TournamentRankingsDashboard/></main></>;
}
