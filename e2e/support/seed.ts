import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import { requiredEnv } from "./env";
import type { E2EState } from "./state";

export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function ensureUser(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
  role: "master_admin" | "organizer" | "viewer",
) {
  const listed = await client.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((candidate) => candidate.email === email);
  if (!user) {
    const created = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { e2e: true },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  } else {
    if (user.app_metadata.e2e !== true) {
      throw new Error(`Refusing to reuse non-E2E Supabase user ${email}`);
    }
    const updated = await client.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (updated.error) throw updated.error;
  }
  const profile = await client.from("profiles").upsert({
    id: user.id,
    email,
    display_name: `E2E ${role}`,
    role,
  });
  if (profile.error) throw profile.error;
  return user.id;
}

export async function seedE2E(): Promise<E2EState> {
  const client = serviceClient();
  const runId = `pw-${Date.now()}`;
  const admin = await ensureUser(client, requiredEnv("E2E_ADMIN_EMAIL"), requiredEnv("E2E_ADMIN_PASSWORD"), "master_admin");
  const organizer = await ensureUser(client, requiredEnv("E2E_ORGANIZER_EMAIL"), requiredEnv("E2E_ORGANIZER_PASSWORD"), "organizer");
  const scorer = await ensureUser(client, requiredEnv("E2E_SCORER_EMAIL"), requiredEnv("E2E_SCORER_PASSWORD"), "viewer");
  const staleData = await client.from("tournaments").delete().in("organizer_id", [admin, organizer]);
  if (staleData.error) throw staleData.error;

  const tournament = await client.from("tournaments").insert({
    name: `E2E Premier ${runId}`,
    tournament_name: `E2E Premier ${runId}`,
    organizer_id: organizer,
    venue: "Playwright Ground",
    start_date: "2026-08-01",
    end_date: "2026-08-02",
    overs: 1,
    overs_per_match: 1,
    players_per_team: 2,
    max_teams: 2,
    status: "ongoing",
  }).select("id").single();
  if (tournament.error) throw tournament.error;

  const teams = await client.from("teams").insert([
    { name: `E2E Strikers ${runId}`, team_name: `E2E Strikers ${runId}`, tournament_id: tournament.data.id, organizer_id: organizer },
    { name: `E2E Blazers ${runId}`, team_name: `E2E Blazers ${runId}`, tournament_id: tournament.data.id, organizer_id: organizer },
  ]).select("id,name");
  if (teams.error || teams.data.length !== 2) throw teams.error || new Error("Unable to seed two teams");
  const teamIds = [teams.data[0].id, teams.data[1].id] as [string, string];

  const suffix = Date.now().toString().slice(-7);
  const players = await client.from("players").insert([
    { name: `E2E Batter One ${runId}`, player_name: `E2E Batter One ${runId}`, role: "batsman", playing_role: "Batsman", team_id: teamIds[0], phone_number: `770${suffix}` },
    { name: `E2E Batter Two ${runId}`, player_name: `E2E Batter Two ${runId}`, role: "batsman", playing_role: "Batsman", team_id: teamIds[0], phone_number: `771${suffix}` },
    { name: `E2E Bowler One ${runId}`, player_name: `E2E Bowler One ${runId}`, role: "bowler", playing_role: "Bowler", team_id: teamIds[1], phone_number: `772${suffix}` },
    { name: `E2E Bowler Two ${runId}`, player_name: `E2E Bowler Two ${runId}`, role: "bowler", playing_role: "Bowler", team_id: teamIds[1], phone_number: `773${suffix}` },
  ]).select("id");
  if (players.error || players.data.length !== 4) throw players.error || new Error("Unable to seed four players");
  const playerIds = players.data.map((player) => player.id) as E2EState["playerIds"];

  const match = await client.from("matches").insert({
    tournament_id: tournament.data.id,
    organizer_id: organizer,
    assigned_scorer_id: scorer,
    team_a_id: teamIds[0],
    team_b_id: teamIds[1],
    match_scope: "tournament",
    match_type: "tournament",
    status: "live",
    overs_per_match: 1,
    wickets_per_innings: 2,
    title: `E2E Match ${runId}`,
  }).select("id").single();
  if (match.error) throw match.error;

  const squads = await client.from("match_squads").insert(playerIds.map((playerId, index) => ({
    match_id: match.data.id,
    player_id: playerId,
    team_id: index < 2 ? teamIds[0] : teamIds[1],
    is_captain: index === 0 || index === 2,
  })));
  if (squads.error) throw squads.error;

  const role = await client.from("user_roles").insert({
    user_id: scorer,
    role: "scorer",
    tournament_id: tournament.data.id,
  });
  if (role.error) throw role.error;

  const auctionPlayer = await client.from("auction_players").insert({
    tournament_id: tournament.data.id,
    registration_number: 1,
    player_name: `E2E Auction Player ${runId}`,
    photo_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    playing_role: "All-rounder",
    batting_style: "Right-hand",
    bowling_style: "Right-arm",
    source_type: "bulk_upload",
  });
  if (auctionPlayer.error) throw auctionPlayer.error;

  return { runId, users: { admin, organizer, scorer }, tournamentId: tournament.data.id, teamIds, playerIds, matchId: match.data.id };
}

export async function cleanupE2E(state: E2EState) {
  const client = serviceClient();
  const result = await client.from("tournaments").delete().in("organizer_id", [state.users.admin, state.users.organizer]);
  if (result.error) throw result.error;
  for (const id of Object.values(state.users)) {
    const deleted = await client.auth.admin.deleteUser(id);
    if (deleted.error) throw deleted.error;
  }
}
