import test from "node:test";
import assert from "node:assert/strict";
import { calculateTournamentStandings } from "../lib/tournament-standings.ts";

test("equal points-table teams follow their configured fixture order", () => {
  const teams = [
    { id: "team-3", name: "Three", logo_url: null, fixture_order: 3 },
    { id: "team-1", name: "One", logo_url: null, fixture_order: 1 },
    { id: "team-2", name: "Two", logo_url: null, fixture_order: 2 },
  ];
  const standings = calculateTournamentStandings(teams, [], []);
  assert.deepEqual(standings.map((row) => row.team_id), ["team-1", "team-2", "team-3"]);
});

test("points and NRR remain ahead of fixture order", () => {
  const teams = [
    { id: "team-1", name: "One", logo_url: null, fixture_order: 1 },
    { id: "team-2", name: "Two", logo_url: null, fixture_order: 2 },
  ];
  const matches = [{ id: "match-1", team_a_id: "team-1", team_b_id: "team-2", status: "completed", winner_id: "team-2" }];
  const standings = calculateTournamentStandings(teams, matches, []);
  assert.deepEqual(standings.map((row) => row.team_id), ["team-2", "team-1"]);
});

test("official NRR counts an all-out innings as the full allocated quota", () => {
  const teams = [
    { id: "team-1", name: "One", logo_url: null },
    { id: "team-2", name: "Two", logo_url: null },
  ];
  const matches = [{ id: "match-1", team_a_id: "team-1", team_b_id: "team-2", status: "completed", winner_id: "team-2", overs_per_match: 10, balls_per_over: 6, wickets_per_innings: 10 }];
  const innings = [
    { match_id: "match-1", batting_team_id: "team-1", bowling_team_id: "team-2", total_runs: 50, total_wickets: 10, balls_bowled: 30 },
    { match_id: "match-1", batting_team_id: "team-2", bowling_team_id: "team-1", total_runs: 51, total_wickets: 1, balls_bowled: 31 },
  ];
  const standings = calculateTournamentStandings(teams, matches, innings);
  assert.equal(standings.find((row) => row.team_id === "team-1").nrr, -4.871);
  assert.equal(standings.find((row) => row.team_id === "team-2").nrr, 4.871);
});
