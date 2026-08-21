export type StandingsTeam = { id: string; name: string; logo_url: string | null; fixture_order?: number | null };
export type StandingsMatch = {
  id: string; team_a_id: string; team_b_id: string; status: string; winner_id: string | null;
  overs_per_match?: number | null; balls_per_over?: number | null; wickets_per_innings?: number | null;
  revised_overs?: number | null;
};
export type StandingsInnings = { match_id: string; batting_team_id: string; bowling_team_id: string; total_runs: number; total_wickets: number; balls_bowled: number };
export type StandingRow = { team_id: string; played: number; won: number; lost: number; tied: number; points: number; nrr: number };
export type PointsRules = { win: number; tie: number; loss: number };
export const defaultPointsRules: PointsRules = { win: 2, tie: 1, loss: 0 };

export function calculateTournamentStandings(teams: StandingsTeam[], matches: StandingsMatch[], innings: StandingsInnings[], rules: PointsRules = defaultPointsRules): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const fixtureOrder = new Map(teams.map((team, index) => [team.id, team.fixture_order ?? Number.MAX_SAFE_INTEGER - teams.length + index]));
  const runData = new Map<string, { runsFor: number; ballsFor: number; runsAgainst: number; ballsAgainst: number }>();
  for (const team of teams) {
    rows.set(team.id, { team_id: team.id, played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0 });
    runData.set(team.id, { runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0 });
  }

  const completedIds = new Set<string>();
  for (const match of matches) {
    if (match.status !== "completed") continue;
    completedIds.add(match.id);
    const teamA = rows.get(match.team_a_id);
    const teamB = rows.get(match.team_b_id);
    if (!teamA || !teamB) continue;
    teamA.played += 1;
    teamB.played += 1;
    if (match.winner_id === match.team_a_id) {
      teamA.won += 1; teamA.points += rules.win; teamB.lost += 1; teamB.points += rules.loss;
    } else if (match.winner_id === match.team_b_id) {
      teamB.won += 1; teamB.points += rules.win; teamA.lost += 1; teamA.points += rules.loss;
    } else {
      teamA.tied += 1; teamB.tied += 1; teamA.points += rules.tie; teamB.points += rules.tie;
    }
  }

  const matchesById = new Map(matches.map((match) => [match.id, match]));
  for (const item of innings) {
    if (!completedIds.has(item.match_id)) continue;
    const match = matchesById.get(item.match_id);
    if (!match) continue;
    const batting = runData.get(item.batting_team_id);
    const bowling = runData.get(item.bowling_team_id);
    if (!batting || !bowling) continue;
    const ballsPerOver = Math.max(1, Number(match.balls_per_over || 6));
    const allocatedBalls = Math.max(0, Number(match.revised_overs || match.overs_per_match || 0) * ballsPerOver);
    const wicketLimit = Math.max(1, Number(match.wickets_per_innings || 10));
    // Official NRR convention: an all-out side is treated as having used its
    // full innings allocation, even when it was dismissed early.
    const ballsUsed = item.total_wickets >= wicketLimit && allocatedBalls
      ? allocatedBalls
      : allocatedBalls ? Math.min(Number(item.balls_bowled || 0), allocatedBalls) : Number(item.balls_bowled || 0);
    batting.runsFor += Number(item.total_runs || 0);
    batting.ballsFor += ballsUsed;
    bowling.runsAgainst += Number(item.total_runs || 0);
    bowling.ballsAgainst += ballsUsed;
  }

  for (const row of rows.values()) {
    const totals = runData.get(row.team_id)!;
    // All matches in a tournament use one ball-per-over format. The values
    // below are stored as legal-ball totals, so NRR remains mathematically
    // correct even when a side is all out or an innings uses a revised quota.
    const ballsPerOver = Math.max(1, Number(matches.find((match) => match.team_a_id === row.team_id || match.team_b_id === row.team_id)?.balls_per_over || 6));
    const forRate = totals.ballsFor ? totals.runsFor / (totals.ballsFor / ballsPerOver) : 0;
    const againstRate = totals.ballsAgainst ? totals.runsAgainst / (totals.ballsAgainst / ballsPerOver) : 0;
    row.nrr = Number((forRate - againstRate).toFixed(3));
  }

  return [...rows.values()].sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won || fixtureOrder.get(a.team_id)! - fixtureOrder.get(b.team_id)!);
}
