export type StandingsTeam = { id: string; name: string; logo_url: string | null; fixture_order?: number | null };
export type StandingsMatch = { id: string; team_a_id: string; team_b_id: string; status: string; winner_id: string | null };
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

  for (const item of innings) {
    if (!completedIds.has(item.match_id)) continue;
    const batting = runData.get(item.batting_team_id);
    const bowling = runData.get(item.bowling_team_id);
    if (!batting || !bowling) continue;
    batting.runsFor += Number(item.total_runs || 0);
    batting.ballsFor += Number(item.balls_bowled || 0);
    bowling.runsAgainst += Number(item.total_runs || 0);
    bowling.ballsAgainst += Number(item.balls_bowled || 0);
  }

  for (const row of rows.values()) {
    const totals = runData.get(row.team_id)!;
    const forRate = totals.ballsFor ? totals.runsFor / (totals.ballsFor / 6) : 0;
    const againstRate = totals.ballsAgainst ? totals.runsAgainst / (totals.ballsAgainst / 6) : 0;
    row.nrr = Number((forRate - againstRate).toFixed(3));
  }

  return [...rows.values()].sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won || fixtureOrder.get(a.team_id)! - fixtureOrder.get(b.team_id)!);
}
