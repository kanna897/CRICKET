"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PublicNav } from "@/components/public-nav";

type Team = { id: string; name: string; logo_url: string | null }; type Player = { team_id: string | null };
export default function TeamsPage() { const [teams, setTeams] = useState<Team[]>([]); const [players, setPlayers] = useState<Player[]>([]); useEffect(() => { void (async () => { const [{ data: teamRows }, { data: playerRows }] = await Promise.all([(supabase.from("teams") as any).select("id,name,logo_url").order("name"), (supabase.from("players") as any).select("team_id")]); setTeams(teamRows || []); setPlayers(playerRows || []); })(); }, []); return <><PublicNav /><main className="mx-auto max-w-5xl p-4 sm:p-7"><p className="text-sm font-bold uppercase tracking-widest text-sky-600">Tournament teams</p><h1 className="mb-6 text-3xl font-black text-slate-900">Teams & Squads</h1><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{teams.map((team) => <Link key={team.id} href={`/teams/${team.id}`} className="group rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"><div className="flex items-center gap-4">{team.logo_url ? <img src={team.logo_url} alt="" className="h-14 w-14 rounded-full border border-sky-100 object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 font-black text-sky-700">{team.name.slice(0, 1)}</div>}<div className="min-w-0"><h2 className="truncate text-lg font-black text-slate-900 group-hover:text-sky-700">{team.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Users className="h-4 w-4" />{players.filter((player) => player.team_id === team.id).length} players</p></div></div></Link>)}</div></main></>; }
