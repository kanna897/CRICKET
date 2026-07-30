"use client";
 

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Trophy, Users, UserRound, Radio } from "lucide-react";
import { supabase } from "@/lib/supabase";

type SearchResult = { id: string; label: string; detail: string; href: string; type: "Tournament" | "Team" | "Player" | "Match" };

const icons = { Tournament: Trophy, Team: Users, Player: UserRound, Match: Radio };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const pattern = `%${term.replaceAll("%", "")}%`;
      const db = supabase;
      const [tournaments, teams, players] = await Promise.all([
        db.from("tournaments").select("id,name,status").ilike("name", pattern).limit(5),
        db.from("teams").select("id,name,tournament_id").ilike("name", pattern).limit(5),
        db.from("players").select("id,name,playing_role").ilike("name", pattern).limit(5),
      ]);
      const matchQuery = Number.isFinite(Number(term))
        ? await db.from("matches").select("id,match_number,status").eq("match_number", Number(term)).limit(5)
        : { data: [] };
      if (!active) return;
      setResults([
        ...((tournaments.data || []) as Array<{ id: string; name: string; status: string }>).map((item) => ({ id: item.id, label: item.name, detail: item.status, href: `/admin/tournaments/${item.id}`, type: "Tournament" as const })),
        ...((teams.data || []) as Array<{ id: string; name: string }>).map((item) => ({ id: item.id, label: item.name, detail: "Team", href: "/admin/teams", type: "Team" as const })),
        ...((players.data || []) as Array<{ id: string; name: string; playing_role: string | null }>).map((item) => ({ id: item.id, label: item.name, detail: item.playing_role || "Player", href: `/admin/players/${item.id}`, type: "Player" as const })),
        ...(((matchQuery.data || []) as Array<{ id: string; match_number: number | null; status: string }>).map((item) => ({ id: item.id, label: `Match ${item.match_number ?? "fixture"}`, detail: item.status, href: `/admin/matches/score/${item.id}`, type: "Match" as const }))),
      ]);
      setLoading(false);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const open = query.trim().length >= 2;
  return <div className="relative w-full max-w-md">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments, teams, players, match #" aria-label="Search admin data" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
    {open && <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {loading ? <p className="p-4 text-sm text-muted-foreground">Searching…</p> : results.length ? <div className="max-h-80 overflow-y-auto p-2">{results.map((result) => { const Icon = icons[result.type]; return <Link key={`${result.type}:${result.id}`} href={result.href} onClick={() => setQuery("")} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{result.label}</span><span className="block text-xs capitalize text-muted-foreground">{result.type} · {result.detail}</span></span></Link>; })}</div> : <p className="p-4 text-sm text-muted-foreground">No matching records found.</p>}
    </div>}
  </div>;
}
