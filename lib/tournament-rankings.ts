import {
  calculateTournamentPlayerStats,
  type PlayerTournamentStat,
  type StatisticsBall,
  type StatisticsInnings,
  type StatisticsPlayer,
  type StatisticsTeam,
} from "@/lib/tournament-statistics";

export type RankingMatch = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  winner_id: string | null;
  status: string | null;
  result_type?: string | null;
  overs_per_match: number;
};

export type RankingInnings = StatisticsInnings & {
  total_runs: number;
  total_wickets: number;
  balls_bowled: number;
};

export type TeamRanking = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  ratingPoints: number;
  rating: number;
  nrr: number;
};

export type PlayerRanking = PlayerTournamentStat & {
  battingRank: number;
  bowlingRank: number;
  allRounderRank: number;
  bowlingAverage: number;
  allRounderPoints: number;
  battingRating: number;
  bowlingRating: number;
};

export function calculateTournamentRankings(
  teams: StatisticsTeam[],
  players: StatisticsPlayer[],
  matches: RankingMatch[],
  innings: RankingInnings[],
  balls: StatisticsBall[],
) {
  const completedMatches = matches.filter((match) => match.status === "completed");
  const completedMatchIds = new Set(completedMatches.map((match) => match.id));
  const completedInnings = innings.filter((item) => completedMatchIds.has(item.match_id));
  const completedInningsIds = new Set(completedInnings.map((item) => item.id));
  const completedBalls = balls.filter((ball) => completedInningsIds.has(ball.innings_id));
  const basePlayers = calculateTournamentPlayerStats(players, teams, completedInnings, completedBalls);

  const batting = basePlayers.filter((row) => row.runs > 0).sort((a, b) =>
    battingRating(b) - battingRating(a) || b.runs - a.runs || b.average - a.average || a.playerName.localeCompare(b.playerName));
  const bowling = basePlayers.filter((row) => row.wickets > 0).sort((a, b) =>
    bowlingRating(b) - bowlingRating(a) || b.wickets - a.wickets || a.economy - b.economy || a.playerName.localeCompare(b.playerName));
  const allRounders = basePlayers
    .filter((row) => row.runs > 0 && row.wickets > 0)
    .sort((a, b) => allRounderPoints(b) - allRounderPoints(a) || b.runs - a.runs || b.wickets - a.wickets);

  const battingRanks = rankMap(batting);
  const bowlingRanks = rankMap(bowling);
  const allRounderRanks = rankMap(allRounders);
  const playerRankings: PlayerRanking[] = basePlayers.map((row) => ({
    ...row,
    battingRank: battingRanks.get(row.playerId) || 0,
    bowlingRank: bowlingRanks.get(row.playerId) || 0,
    allRounderRank: allRounderRanks.get(row.playerId) || 0,
    bowlingAverage: bowlingAverage(row),
    allRounderPoints: allRounderPoints(row),
    battingRating: battingRating(row),
    bowlingRating: bowlingRating(row),
  }));

  const matchById = new Map(completedMatches.map((match) => [match.id, match]));
  const teamRankings: TeamRanking[] = teams.map((team) => {
    const teamMatches = completedMatches.filter((match) => match.team_a_id === team.id || match.team_b_id === team.id);
    const won = teamMatches.filter((match) => match.winner_id === team.id).length;
    const tied = teamMatches.filter((match) => match.result_type === "tie").length;
    const noResult = teamMatches.filter((match) => match.result_type === "no_result" || (!match.winner_id && match.result_type !== "tie")).length;
    const lost = Math.max(teamMatches.length - won - tied - noResult, 0);
    let runsFor = 0, ballsFor = 0, runsAgainst = 0, ballsAgainst = 0;
    completedInnings.forEach((item) => {
      const match = matchById.get(item.match_id);
      if (!match || ![match.team_a_id, match.team_b_id].includes(team.id)) return;
      if (match.result_type === "no_result" || (!match.winner_id && match.result_type !== "tie")) return;
      const quota = Math.max(match.overs_per_match || 20, 1) * 6;
      const usedBalls = item.total_wickets >= 10 ? quota : Math.min(item.balls_bowled, quota);
      if (item.batting_team_id === team.id) {
        runsFor += item.total_runs;
        ballsFor += usedBalls;
      } else {
        runsAgainst += item.total_runs;
        ballsAgainst += usedBalls;
      }
    });
    const nrr = ballsFor && ballsAgainst ? (runsFor * 6) / ballsFor - (runsAgainst * 6) / ballsAgainst : 0;
    const ratingPoints = won * 120 + (tied + noResult) * 100 + lost * 80;
    return {
      teamId: team.id,
      teamName: team.name,
      logoUrl: team.logo_url || null,
      played: teamMatches.length,
      won,
      lost,
      tied,
      noResult,
      points: won * 2 + tied + noResult,
      ratingPoints,
      rating: teamMatches.length ? Math.round(ratingPoints / teamMatches.length) : 0,
      nrr,
    };
  }).filter((row) => row.played > 0).sort((a, b) =>
    b.rating - a.rating || b.ratingPoints - a.ratingPoints || b.won - a.won || b.nrr - a.nrr || a.teamName.localeCompare(b.teamName));

  return {
    teams: teamRankings,
    batsmen: batting.map((row) => playerRankings.find((item) => item.playerId === row.playerId)!),
    bowlers: bowling.map((row) => playerRankings.find((item) => item.playerId === row.playerId)!),
    allRounders: allRounders.map((row) => playerRankings.find((item) => item.playerId === row.playerId)!),
  };
}

function rankMap(rows: PlayerTournamentStat[]) {
  return new Map(rows.map((row, index) => [row.playerId, index + 1]));
}

function bowlingAverage(row: PlayerTournamentStat) {
  return row.wickets ? row.bowlingRuns / row.wickets : row.bowlingRuns;
}

function allRounderPoints(row: PlayerTournamentStat) {
  return Math.round((battingRating(row) * bowlingRating(row)) / 1000);
}

function experienceFactor(matches: number) {
  return 0.65 + Math.min(matches / 5, 1) * 0.35;
}

function battingRating(row: PlayerTournamentStat) {
  if (!row.runs || !row.matches) return 0;
  const raw = (row.runs / row.matches) * 7 + row.average * 3 + Math.min(row.strikeRate, 250) * 1.15 + row.highestScore * 0.75;
  return Math.round(Math.min(1000, raw * experienceFactor(row.matches)));
}

function bowlingRating(row: PlayerTournamentStat) {
  if (!row.wickets || !row.matches) return 0;
  const averageScore = Math.max(0, 220 - bowlingAverage(row) * 5);
  const economyScore = Math.max(0, 220 - row.economy * 20);
  const raw = (row.wickets / row.matches) * 150 + averageScore + economyScore + row.wickets * 8;
  return Math.round(Math.min(1000, raw * experienceFactor(row.matches)));
}
