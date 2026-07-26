import { isBowlerCreditedWicket, runsChargedToBowler } from "@/lib/cricket-rules";

export type StatisticsPlayer = { id: string; name: string; team_id: string | null; photo_url?: string | null };
export type StatisticsTeam = { id: string; name: string; logo_url?: string | null };
export type StatisticsInnings = { id: string; match_id: string; batting_team_id: string; bowling_team_id: string };
export type StatisticsBall = {
  innings_id: string;
  over_number?: number | null;
  batsman_id: string | null;
  bowler_id: string | null;
  player_out_id?: string | null;
  fielder_id?: string | null;
  runs: number;
  extras: number;
  extras_type: string | null;
  is_legal: boolean;
  is_wicket: boolean;
  dismissal_type: string | null;
};

export type StatisticsMatch = {
  id: string;
  status: string | null;
  player_of_match_id?: string | null;
};

export type MvpTournamentStat = PlayerTournamentStat & {
  maidenOvers: number;
  playerOfMatchAwards: number;
  runPoints: number;
  boundaryBonus: number;
  wicketPoints: number;
  maidenPoints: number;
  fieldingPoints: number;
  playerOfMatchPoints: number;
  mvpPoints: number;
};

export type PlayerTournamentStat = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string;
  photoUrl: string | null;
  matches: number;
  runs: number;
  ballsFaced: number;
  highestScore: number;
  average: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  wickets: number;
  bowlingRuns: number;
  bowlingBalls: number;
  economy: number;
  bestBowling: string;
  catches: number;
  runOuts: number;
  stumpings: number;
  fieldingDismissals: number;
};

export function calculateTournamentPlayerStats(players: StatisticsPlayer[], teams: StatisticsTeam[], innings: StatisticsInnings[], balls: StatisticsBall[]): PlayerTournamentStat[] {
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const inningsById = new Map(innings.map((item) => [item.id, item]));

  return players.map((player) => {
    const battingBalls = balls.filter((ball) => ball.batsman_id === player.id);
    const bowlingBalls = balls.filter((ball) => ball.bowler_id === player.id);
    const fieldingBalls = balls.filter((ball) => ball.is_wicket && ball.fielder_id === player.id);
    const matchIds = new Set([...battingBalls, ...bowlingBalls, ...fieldingBalls].map((ball) => inningsById.get(ball.innings_id)?.match_id).filter(Boolean));
    const runs = battingBalls.reduce((sum, ball) => sum + ball.runs, 0);
    const ballsFaced = battingBalls.filter((ball) => ball.is_legal).length;
    const dismissals = balls.filter((ball) => ball.is_wicket && ball.player_out_id === player.id && ball.dismissal_type !== "retired_hurt").length;
    const inningsScores = new Map<string, number>();
    battingBalls.forEach((ball) => inningsScores.set(ball.innings_id, (inningsScores.get(ball.innings_id) || 0) + ball.runs));
    const bowlingRuns = bowlingBalls.reduce((sum, ball) => sum + runsChargedToBowler(ball), 0);
    const bowlingLegalBalls = bowlingBalls.filter((ball) => ball.is_legal).length;
    const creditedWickets = bowlingBalls.filter(isBowlerCreditedWicket);
    const bowlingByInnings = new Map<string, { wickets: number; runs: number }>();
    bowlingBalls.forEach((ball) => {
      const current = bowlingByInnings.get(ball.innings_id) || { wickets: 0, runs: 0 };
      current.runs += runsChargedToBowler(ball);
      if (isBowlerCreditedWicket(ball)) current.wickets += 1;
      bowlingByInnings.set(ball.innings_id, current);
    });
    const best = [...bowlingByInnings.values()].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
    const catches = fieldingBalls.filter((ball) => ball.dismissal_type === "caught").length;
    const runOuts = fieldingBalls.filter((ball) => ball.dismissal_type === "run_out").length;
    const stumpings = fieldingBalls.filter((ball) => ball.dismissal_type === "stumped").length;
    return {
      playerId: player.id,
      playerName: player.name,
      teamId: player.team_id,
      teamName: teamNames.get(player.team_id || "") || "Unassigned",
      photoUrl: player.photo_url || null,
      matches: matchIds.size,
      runs,
      ballsFaced,
      highestScore: Math.max(0, ...inningsScores.values()),
      average: dismissals ? runs / dismissals : runs,
      strikeRate: ballsFaced ? (runs * 100) / ballsFaced : 0,
      fours: battingBalls.filter((ball) => ball.runs === 4).length,
      sixes: battingBalls.filter((ball) => ball.runs === 6).length,
      wickets: creditedWickets.length,
      bowlingRuns,
      bowlingBalls: bowlingLegalBalls,
      economy: bowlingLegalBalls ? (bowlingRuns * 6) / bowlingLegalBalls : 0,
      bestBowling: best ? `${best.wickets}/${best.runs}` : "0/0",
      catches,
      runOuts,
      stumpings,
      fieldingDismissals: catches + runOuts + stumpings,
    };
  }).filter((row) => row.matches > 0);
}

export function calculateMvpTournamentStats(players: StatisticsPlayer[], teams: StatisticsTeam[], innings: StatisticsInnings[], balls: StatisticsBall[], matches: StatisticsMatch[]): MvpTournamentStat[] {
  const completedMatches = matches.filter((match) => match.status === "completed");
  const completedMatchIds = new Set(completedMatches.map((match) => match.id));
  const completedInnings = innings.filter((item) => completedMatchIds.has(item.match_id));
  const completedInningsIds = new Set(completedInnings.map((item) => item.id));
  const completedBalls = balls.filter((ball) => completedInningsIds.has(ball.innings_id));
  const baseStats = calculateTournamentPlayerStats(players, teams, completedInnings, completedBalls);

  return baseStats.map((player) => {
    const bowlingBalls = completedBalls.filter((ball) => ball.bowler_id === player.playerId);
    const overs = new Map<string, StatisticsBall[]>();
    bowlingBalls.forEach((ball) => {
      const key = `${ball.innings_id}:${ball.over_number ?? 0}`;
      overs.set(key, [...(overs.get(key) || []), ball]);
    });
    const maidenOvers = [...overs.values()].filter((overBalls) => {
      const legalBalls = overBalls.filter((ball) => ball.is_legal);
      const chargedRuns = overBalls.reduce((sum, ball) => sum + ball.runs + (["bye", "leg_bye"].includes(ball.extras_type || "") ? 0 : ball.extras), 0);
      return legalBalls.length === 6 && chargedRuns === 0;
    }).length;
    const playerOfMatchAwards = completedMatches.filter((match) => match.player_of_match_id === player.playerId).length;
    const runPoints = player.runs;
    const boundaryBonus = player.fours + player.sixes * 2;
    const wicketPoints = player.wickets * 25;
    const maidenPoints = maidenOvers * 12;
    const fieldingPoints = player.catches * 8 + player.stumpings * 12 + player.runOuts * 12;
    const playerOfMatchPoints = playerOfMatchAwards * 20;
    return {
      ...player,
      maidenOvers,
      playerOfMatchAwards,
      runPoints,
      boundaryBonus,
      wicketPoints,
      maidenPoints,
      fieldingPoints,
      playerOfMatchPoints,
      mvpPoints: runPoints + boundaryBonus + wicketPoints + maidenPoints + fieldingPoints + playerOfMatchPoints,
    };
  }).sort((a, b) => b.mvpPoints - a.mvpPoints || b.runs - a.runs || b.wickets - a.wickets);
}
