"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ClipboardList, PlayCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
type Match = {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  ground: string | null;
  match_date: string | null;
  match_time: string | null;
  status: string;
  overs_per_match: number;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatches() {
      const [matchesResult, teamsResult, tournamentsResult] = await Promise.all([
        (supabase.from("matches") as any).select("*").order("created_at", { ascending: false }),
        supabase.from("teams").select("*").order("name"),
        supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      ]);
      if (matchesResult.data) setMatches(matchesResult.data);
      if (teamsResult.data) setTeams(teamsResult.data);
      if (tournamentsResult.data) setTournaments(tournamentsResult.data);
      setLoading(false);
    }
    loadMatches();
  }, []);

  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || "Unknown team";
  const tournamentName = (id: string | null) => tournaments.find((tournament) => tournament.id === id)?.name || "Independent match";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Matches & Scoring</h1><p className="text-muted-foreground mt-1">Schedule fixtures and start live scoring.</p></div>
        <Link href="/admin/matches/new" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 text-sm font-medium"><CalendarPlus className="w-4 h-4 mr-2" />Schedule Match</Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? <div className="py-14 text-center text-muted-foreground">Loading matches…</div> : matches.length === 0 ? (
          <div className="py-16 text-center"><ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><h2 className="font-semibold">No matches scheduled</h2><p className="text-sm text-muted-foreground mt-1">Create a fixture to begin scoring.</p></div>
        ) : <div className="divide-y divide-border">
          {matches.map((match) => <div key={match.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div><p className="text-xs text-muted-foreground mb-1">{tournamentName(match.tournament_id)}</p><h2 className="text-lg font-semibold">{teamName(match.team_a_id)} <span className="text-muted-foreground font-normal">vs</span> {teamName(match.team_b_id)}</h2><p className="text-sm text-muted-foreground mt-1">{match.match_date || "Date TBC"} {match.match_time ? `• ${match.match_time}` : ""} {match.ground ? `• ${match.ground}` : ""} • {match.overs_per_match} overs</p></div>
            <div className="flex items-center gap-3"><span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">{match.status}</span><Link href={`/admin/matches/score/${match.id}`} className="inline-flex items-center rounded-md bg-primary text-primary-foreground h-9 px-3 text-sm font-medium"><PlayCircle className="w-4 h-4 mr-1" />Score</Link><Link href={`/admin/matches/teamsheet/${match.id}`} className="inline-flex items-center rounded-md border border-input h-9 px-3 text-sm font-medium">Team Sheet</Link></div>
          </div>)}
        </div>}
      </div>
    </div>
  );
}
