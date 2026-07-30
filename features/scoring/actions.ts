import { isBowlerCreditedWicket } from "@/lib/cricket-rules";
import type { Player } from "./types";

type PerformanceBall = {
  batsman_id: string | null;
  bowler_id: string | null;
  runs: number;
  is_wicket: boolean;
  dismissal_type: string | null;
};

export function rankPlayerOfMatch(matchBalls: PerformanceBall[], players: Player[], winnerTeamId?: string | null) {
  const stats = new Map<string, { runs: number; wickets: number }>();
  const add = (playerId: string | null, field: "runs" | "wickets", amount: number) => {
    if (!playerId) return;
    const current = stats.get(playerId) || { runs: 0, wickets: 0 };
    current[field] += amount;
    stats.set(playerId, current);
  };
  matchBalls.forEach((ball) => {
    add(ball.batsman_id, "runs", ball.runs || 0);
    if (isBowlerCreditedWicket(ball)) add(ball.bowler_id, "wickets", 1);
  });
  const ranked = [...stats.entries()].map(([playerId, stat]) => ({
    playerId,
    stat,
    teamId: players.find((player) => player.id === playerId)?.team_id || null,
    impact: stat.runs + stat.wickets * 28 + (stat.runs >= 50 ? 12 : 0) + (stat.wickets >= 3 ? 12 : 0),
  })).sort((a, b) => b.impact - a.impact || b.stat.wickets - a.stat.wickets || b.stat.runs - a.stat.runs);
  const eligible = winnerTeamId ? ranked.filter((candidate) => candidate.teamId === winnerTeamId) : ranked;
  const winner = eligible[0] || ranked[0];
  if (!winner) return null;
  const { playerId, stat } = winner;
  const parts = [
    stat.runs ? `${stat.runs} run${stat.runs === 1 ? "" : "s"}` : "",
    stat.wickets ? `${stat.wickets} wicket${stat.wickets === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return { playerId, summary: parts.join(", ") || "Match contribution" };
}
