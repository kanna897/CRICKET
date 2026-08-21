import type { Player } from "./types";

type PerformanceBall = {
  batsman_id: string | null;
  bowler_id: string | null;
  runs: number;
  extras: number;
  extras_type: string | null;
  is_legal: boolean;
  is_wicket: boolean;
  dismissal_type: string | null;
  fielder_id: string | null;
};

const bowlerCreditedDismissals = new Set(["bowled", "caught", "caught_and_bowled", "lbw", "stumped", "hit_wicket"]);
const normalizeDismissal = (value: string | null | undefined) => (value || "").trim().toLowerCase().replaceAll(" ", "_");
const isBowlerCreditedWicket = (ball: PerformanceBall) => ball.is_wicket && bowlerCreditedDismissals.has(normalizeDismissal(ball.dismissal_type));
const runsChargedToBowler = (ball: PerformanceBall) => ball.runs + (["bye", "leg_bye"].includes(normalizeDismissal(ball.extras_type)) ? 0 : ball.extras);

export function rankPlayerOfMatch(matchBalls: PerformanceBall[], players: Player[], winnerTeamId?: string | null) {
  const stats = new Map<string, { runs: number; balls: number; wickets: number; conceded: number; legalBalls: number; fielding: number }>();
  const add = (playerId: string | null, field: "runs" | "balls" | "wickets" | "conceded" | "legalBalls" | "fielding", amount: number) => {
    if (!playerId) return;
    const current = stats.get(playerId) || { runs: 0, balls: 0, wickets: 0, conceded: 0, legalBalls: 0, fielding: 0 };
    current[field] += amount;
    stats.set(playerId, current);
  };
  matchBalls.forEach((ball) => {
    add(ball.batsman_id, "runs", ball.runs || 0);
    if (ball.batsman_id && ball.is_legal) add(ball.batsman_id, "balls", 1);
    if (ball.bowler_id) add(ball.bowler_id, "conceded", runsChargedToBowler(ball));
    if (ball.bowler_id && ball.is_legal) add(ball.bowler_id, "legalBalls", 1);
    if (isBowlerCreditedWicket(ball)) add(ball.bowler_id, "wickets", 1);
    if (ball.fielder_id && ["caught", "stumped"].includes(ball.dismissal_type || "")) add(ball.fielder_id, "fielding", 12);
    if (ball.fielder_id && ball.dismissal_type === "run_out") add(ball.fielder_id, "fielding", 10);
  });
  const ranked = [...stats.entries()].map(([playerId, stat]) => {
    const strikeRate = stat.balls ? (stat.runs / stat.balls) * 100 : 0;
    const economy = stat.legalBalls ? stat.conceded / (stat.legalBalls / 6) : Number.POSITIVE_INFINITY;
    const battingImpact = stat.runs + (stat.balls >= 6 ? strikeRate >= 200 ? 15 : strikeRate >= 150 ? 10 : strikeRate >= 120 ? 5 : 0 : 0) + (stat.runs >= 100 ? 20 : stat.runs >= 50 ? 12 : 0);
    const bowlingImpact = stat.wickets * 28 + (stat.legalBalls >= 6 ? economy <= 4 ? 15 : economy <= 6 ? 10 : economy <= 8 ? 5 : 0 : 0) + (stat.wickets >= 5 ? 20 : stat.wickets >= 3 ? 12 : 0);
    return {
    playerId,
    stat,
    teamId: players.find((player) => player.id === playerId)?.team_id || null,
    impact: battingImpact + bowlingImpact + stat.fielding,
  };
  }).sort((a, b) => b.impact - a.impact || b.stat.wickets - a.stat.wickets || b.stat.runs - a.stat.runs || b.stat.fielding - a.stat.fielding);
  // CricHeroes-style preference: choose a winning-team player if one appears
  // in the top three overall MVP performers. Otherwise retain the top player,
  // allowing an extraordinary losing-side performance to win the award.
  const topThree = ranked.slice(0, 3);
  const winner = winnerTeamId ? topThree.find((candidate) => candidate.teamId === winnerTeamId) || topThree[0] : topThree[0];
  if (!winner) return null;
  const { playerId, stat } = winner;
  const parts = [
    stat.runs ? `${stat.runs} run${stat.runs === 1 ? "" : "s"}` : "",
    stat.wickets ? `${stat.wickets} wicket${stat.wickets === 1 ? "" : "s"}` : "",
    stat.fielding ? `${stat.fielding >= 12 ? "fielding contribution" : "run-out contribution"}` : "",
  ].filter(Boolean);
  return { playerId, summary: parts.join(", ") || "Match contribution" };
}
