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
