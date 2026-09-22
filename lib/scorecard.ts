import type { InningsScorecard, ScorecardBall, ScorecardInnings, ScorecardPlayer } from "@/types/scorecard";
import { isBowlerCreditedWicket, runsChargedToBowler } from "@/lib/cricket-rules";

const playerName = (players: ScorecardPlayer[], id: string | null) => players.find((player) => player.id === id)?.name || "Player";
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export function formatDismissal(ball: ScorecardBall | undefined, players: ScorecardPlayer[]): string {
  if (!ball || (!ball.is_wicket && ball.dismissal_type !== "retired_hurt" && ball.dismissal_type !== "retired_out")) return "not out";
  const bowlerName = playerName(players, ball.bowler_id);
  const fielderName = ball.fielder_id ? playerName(players, ball.fielder_id) : null;
  const type = ball.dismissal_type || (ball.is_wicket ? "out" : "not out");

  switch (type) {
    case "bowled":
      return `b ${bowlerName}`;
    case "caught":
      if (ball.fielder_id && ball.fielder_id === ball.bowler_id) {
        return `c & b ${bowlerName}`;
      }
      return fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
    case "lbw":
      return `lbw b ${bowlerName}`;
    case "stumped":
      return fielderName ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`;
    case "run_out":
      return fielderName ? `run out (${fielderName})` : "run out";
    case "hit_wicket":
      return `hit wicket b ${bowlerName}`;
    case "retired_hurt":
      return "retired hurt";
    case "retired_out":
      return "retired out";
    case "obstructing_field":
      return "obstructing field";
    case "timed_out":
      return "timed out";
    default:
      return type.replace(/_/g, " ");
  }
}

export function buildScorecard(innings: ScorecardInnings, balls: ScorecardBall[], players: ScorecardPlayer[]): InningsScorecard {
  const batterIds = [...new Set([innings.striker_id, innings.non_striker_id, ...balls.flatMap((ball) => [ball.batsman_id, ball.player_out_id])].filter(Boolean) as string[])];
  const bowlerIds = [...new Set(balls.map((ball) => ball.bowler_id).filter(Boolean) as string[])];
  const batting = batterIds.map((playerId) => {
    const faced = balls.filter((ball) => ball.batsman_id === playerId);
    const runs = faced.reduce((sum, ball) => sum + ball.runs, 0);
    const legalBalls = faced.filter((ball) => ball.is_legal).length;
    const dismissalBall = balls.find((ball) => ball.player_out_id === playerId && (ball.is_wicket || ball.dismissal_type === "retired_hurt" || ball.dismissal_type === "retired_out"));
    let dismissal = formatDismissal(dismissalBall, players);

    // If not dismissed as a wicket, check if batter is currently active on the crease
    if (!dismissalBall) {
      const isOnCrease = playerId === innings.striker_id || playerId === innings.non_striker_id;
      if (!isOnCrease && faced.length > 0) {
        dismissal = "retired hurt";
      }
    }

    return { playerId, name: playerName(players, playerId), runs, balls: legalBalls, fours: faced.filter((ball) => ball.runs === 4).length, sixes: faced.filter((ball) => ball.runs === 6).length, strikeRate: legalBalls ? ((runs / legalBalls) * 100).toFixed(2) : "0.00", dismissal };
  });
  const bowling = bowlerIds.map((playerId) => {
    const delivered = balls.filter((ball) => ball.bowler_id === playerId);
    const legalBalls = delivered.filter((ball) => ball.is_legal).length;
    const conceded = delivered.reduce((sum, ball) => sum + runsChargedToBowler(ball), 0);
    const wickets = delivered.filter(isBowlerCreditedWicket).length;
    const wides = delivered.filter((ball) => ball.extras_type === "wide").reduce((sum, ball) => sum + ball.extras, 0);
    const noBalls = delivered.filter((ball) => ball.extras_type === "no_ball").reduce((sum, ball) => sum + ball.extras, 0);
    return { playerId, name: playerName(players, playerId), balls: legalBalls, runs: conceded, wickets, wides, noBalls, economy: legalBalls ? ((conceded * 6) / legalBalls).toFixed(2) : "0.00" };
  });
  const fallOfWickets = balls.filter((ball) => ball.is_wicket).map((ball) => { const scoreAtWicket = balls.slice(0, balls.indexOf(ball) + 1).reduce((sum, item) => sum + item.runs + item.extras, 0); return { player: playerName(players, ball.player_out_id || null), score: scoreAtWicket, over: `${ball.over_number}.${ball.ball_number}` }; });
  const lastWicketIndex = balls.map((ball) => ball.is_wicket).lastIndexOf(true);
  const partnershipBalls = balls.slice(lastWicketIndex + 1);
  const partnershipBatterIds = [...new Set([innings.striker_id, innings.non_striker_id, ...partnershipBalls.map((ball) => ball.batsman_id)].filter(Boolean) as string[])];
  const partnership = {
    runs: partnershipBalls.reduce((sum, ball) => sum + ball.runs + ball.extras, 0),
    balls: partnershipBalls.filter((ball) => ball.is_legal).length,
    batters: partnershipBatterIds.slice(0, 2).map((playerId) => {
      const faced = partnershipBalls.filter((ball) => ball.batsman_id === playerId);
      return { playerId, name: playerName(players, playerId), runs: faced.reduce((sum, ball) => sum + ball.runs, 0), balls: faced.filter((ball) => ball.is_legal).length };
    }),
  };
  return { batting, bowling, extras: balls.reduce((sum, ball) => sum + ball.extras, 0), total: innings.total_runs, wickets: innings.total_wickets, overs: overs(innings.balls_bowled), fallOfWickets, partnership };
}
