"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EyeOff, Plus, Search, Trophy } from "lucide-react";
import { useAdminAccess } from "@/components/admin-shell";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];

function effectiveTournamentStatus(tournament: Tournament) {
  if (tournament.status !== "upcoming" || !tournament.start_date) return tournament.status;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
  return tournament.start_date <= today ? "ongoing" : "upcoming";
}

export default function TournamentsPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchTournaments = useCallback(async () => {
    let query = supabase.from("tournaments").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    if (!isMasterAdmin) query = query.eq("organizer_id", userId);
    const { data, error } = await query;
    if (error) alert(error.message);
    setTournaments(data ?? []);
    setLoading(false);
  }, [isMasterAdmin, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTournaments(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchTournaments]);

  async function hideTournament(tournament: Tournament) {
    const confirmed = confirm("Hide this tournament?\n\nThe tournament, its teams, matches, fixtures and tournament-related content will be hidden from normal and public views.\n\nNo data will be deleted. Player master records will remain visible.");
    if (!confirmed) return;
    setWorkingId(tournament.id);
    const { data, error } = await supabase.rpc("hide_tournament", { p_tournament_id: tournament.id });
    setWorkingId(null);
    if (error) return alert(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) return alert("Tournament was not found or could not be hidden.");
    await fetchTournaments();
  }

  const filtered = tournaments.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  const tournamentLogo = (tournament: Tournament, mobile = false) => tournament.logo_url ? (
    <Image unoptimized width={mobile ? 48 : 32} height={mobile ? 48 : 32} src={tournament.logo_url} alt={`${tournament.name} logo`} className={`${mobile ? "h-12 w-12" : "h-8 w-8"} shrink-0 rounded-full bg-muted object-cover`} />
  ) : (
    <span className={`grid ${mobile ? "h-12 w-12 text-lg" : "h-8 w-8"} shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary`}>{tournament.name[0]}</span>
  );

  return <div className="admin-themed-page min-w-0 space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0"><h1 className="break-words text-3xl font-bold tracking-tight">Tournaments</h1><p className="mt-1 text-muted-foreground">Manage your active cricket tournaments here.</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href="/admin/tournaments/hidden" className="control justify-center"><EyeOff className="mr-2 h-4 w-4"/>Hidden Tournaments</Link>
        <Link href="/admin/tournaments/new" className="control justify-center bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4"/>New Tournament</Link>
      </div>
    </div>
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="relative mb-6 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input type="search" placeholder="Search tournaments..." value={search} onChange={(event)=>setSearch(event.target.value)} className="w-full rounded-md border border-input bg-transparent py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-primary"/></div>
      {loading ? <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"/></div> : filtered.length === 0 ? <div className="py-12 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Trophy className="h-6 w-6 text-muted-foreground"/></div><h3 className="text-lg font-medium">No active tournaments found</h3></div> : <>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Tournament</th><th className="px-6 py-3">Venue</th><th className="px-6 py-3">Start Date</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody>{filtered.map((tournament)=>{const status=effectiveTournamentStatus(tournament);return <tr key={tournament.id} className="border-b border-border hover:bg-muted/50"><td className="flex items-center gap-3 px-6 py-4 font-medium">{tournamentLogo(tournament)}{tournament.name}</td><td className="px-6 py-4">{tournament.venue||"-"}</td><td className="px-6 py-4">{tournament.start_date||"-"}</td><td className="px-6 py-4">{status}</td><td className="px-6 py-4"><div className="flex justify-end gap-3"><Link href={`/admin/tournaments/${tournament.id}`} className="font-medium text-primary hover:underline">Manage</Link><button type="button" disabled={workingId===tournament.id} onClick={()=>void hideTournament(tournament)} className="inline-flex items-center font-medium text-amber-700 disabled:opacity-50 dark:text-amber-300"><EyeOff className="mr-1 h-4 w-4"/>{workingId===tournament.id?"Hiding…":"Hide Tournament"}</button></div></td></tr>})}</tbody></table></div>
        <div className="grid gap-3 sm:hidden">{filtered.map((tournament)=>{const status=effectiveTournamentStatus(tournament);return <article key={tournament.id} className="min-w-0 rounded-xl border border-border bg-background/45 p-4"><div className="flex min-w-0 items-start gap-3">{tournamentLogo(tournament, true)}<div className="min-w-0 flex-1"><h2 className="break-words font-black leading-tight">{tournament.name}</h2><span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold capitalize text-primary">{status}</span></div></div><dl className="mt-4 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border pt-3 text-sm"><dt className="text-muted-foreground">Venue</dt><dd className="min-w-0 break-words font-semibold">{tournament.venue||"-"}</dd><dt className="text-muted-foreground">Start date</dt><dd className="font-semibold">{tournament.start_date||"-"}</dd></dl><div className="mt-4 grid grid-cols-2 gap-2"><Link href={`/admin/tournaments/${tournament.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">Manage</Link><button type="button" disabled={workingId===tournament.id} onClick={()=>void hideTournament(tournament)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-500/40 px-3 text-sm font-bold text-amber-700 disabled:opacity-50 dark:text-amber-300"><EyeOff className="mr-1 h-4 w-4"/>{workingId===tournament.id?"Hiding…":"Hide"}</button></div></article>})}</div>
      </>}
    </div>
  </div>;
}
