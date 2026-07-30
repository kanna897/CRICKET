"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Loader2, PlayCircle, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAccess } from "@/components/admin-shell";

type Tournament = { id: string; name: string; organizer_id: string | null; overs: number; venue: string | null };
type Team = { id: string; name: string; logo_url: string | null; tournament_id: string };
type Match = { id: string; tournament_id: string; team_a_id: string; team_b_id: string; winner_id: string | null; status: string; bracket_round: number; bracket_slot: number; match_date: string | null };

export default function KnockoutBracketPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState("");
  const [size, setSize] = useState("4");
  const [startDate, setStartDate] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load(tournamentId?: string) {
    let tournamentQuery = supabase.from("tournaments").select("id,name,organizer_id,overs,venue").is("deleted_at", null).order("name");
    if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
    const { data: tournamentRows } = await tournamentQuery;
    const rows = (tournamentRows || []) as Tournament[];
    setTournaments(rows);
    const active = tournamentId || selected || rows[0]?.id || "";
    if (!active) return;
    setSelected(active);
    const [{ data: teamRows }, { data: matchRows }] = await Promise.all([
      supabase.from("teams").select("id,name,logo_url,tournament_id").eq("tournament_id", active).is("deleted_at", null).order("name"),
      supabase.from("matches").select("id,tournament_id,team_a_id,team_b_id,winner_id,status,bracket_round,bracket_slot,match_date").eq("tournament_id", active).eq("competition_stage", "knockout").order("bracket_round").order("bracket_slot"),
    ]);
    setTeams((teamRows || []) as Team[]);
    setMatches((matchRows || []) as Match[]);
  }
  useEffect(() => { void load(); }, [isMasterAdmin, userId]);

  const rounds = useMemo(() => [...new Set(matches.map((match) => match.bracket_round))].sort((a,b)=>a-b), [matches]);
  const team = (id: string) => teams.find((item) => item.id === id);
  const roundTitle = (round: number) => {
    const remaining = Math.max(1, Number(size) / (2 ** round));
    return remaining === 1 ? "Final" : remaining === 2 ? "Semifinals" : remaining === 4 ? "Quarterfinals" : `Round ${round}`;
  };

  async function generate() {
    setMessage("");
    const count = Number(size);
    if (!startDate) return setMessage("Select the knockout start date.");
    if (teams.length < count) return setMessage(`${count} teams required; this tournament has ${teams.length}.`);
    if (matches.length) return setMessage("A knockout bracket already exists for this tournament.");
    setWorking(true);
    const tournament = tournaments.find((item)=>item.id===selected);
    const seeded = teams.slice(0, count);
    const rows = Array.from({ length: count / 2 }, (_, slot) => {
      const date = new Date(`${startDate}T00:00:00`); date.setDate(date.getDate() + slot);
      return { tournament_id:selected, team_a_id:seeded[slot].id, team_b_id:seeded[count-1-slot].id, match_date:date.toISOString().slice(0,10), overs_per_match:tournament?.overs||20, ground:tournament?.venue||null, status:"scheduled", competition_stage:"knockout", bracket_round:1, bracket_slot:slot+1, assigned_scorer_id:tournament?.organizer_id||userId, scoring_locked:false };
    });
    const { error } = await supabase.from("matches").insert(rows);
    setWorking(false);
    if (error) return setMessage(error.message);
    setMessage(`${count}-team knockout bracket created.`);
    await load(selected);
  }

  async function advance() {
    setMessage("");
    const currentRound = Math.max(...rounds);
    const current = matches.filter((match)=>match.bracket_round===currentRound);
    if (!current.length || current.some((match)=>match.status!=="completed"||!match.winner_id)) return setMessage("Current round matches எல்லாம் completed + winner selected ஆக வேண்டும்.");
    if (current.length===1) return setMessage(`${team(current[0].winner_id!)?.name || "Winner"} is the tournament champion.`);
    if (matches.some((match)=>match.bracket_round===currentRound+1)) return setMessage("Next round already exists.");
    setWorking(true);
    const tournament=tournaments.find((item)=>item.id===selected);
    const winners=current.sort((a,b)=>a.bracket_slot-b.bracket_slot).map((match)=>match.winner_id!);
    const rows=Array.from({length:winners.length/2},(_,slot)=>({tournament_id:selected,team_a_id:winners[slot*2],team_b_id:winners[slot*2+1],match_date:null,overs_per_match:tournament?.overs||20,ground:tournament?.venue||null,status:"scheduled",competition_stage:"knockout",bracket_round:currentRound+1,bracket_slot:slot+1,assigned_scorer_id:tournament?.organizer_id||userId,scoring_locked:false}));
    const {error}=await supabase.from("matches").insert(rows);
    setWorking(false);
    if(error)return setMessage(error.message);
    setMessage("Winners advanced to the next round.");
    await load(selected);
  }

  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-primary">Tournament progression</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black"><GitBranch className="h-8 w-8 text-primary"/>Knockout Bracket</h1><p className="mt-2 text-muted-foreground">Seed teams, run elimination rounds and crown the champion.</p></div><div className="flex flex-wrap gap-2"><select className="input min-w-64" value={selected} onChange={(event)=>void load(event.target.value)}>{tournaments.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{matches.length>0&&<button onClick={()=>void advance()} disabled={working} className="control bg-primary text-primary-foreground"><Trophy className="mr-2 h-4 w-4"/>Advance winners</button>}</div></header>{message&&<p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 font-bold">{message}</p>}{!matches.length?<section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-black">Create seeded bracket</h2><p className="mt-1 text-sm text-muted-foreground">Alphabetical seed order: 1 vs last, 2 vs second-last.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="space-y-2 text-sm font-bold">Bracket size<select className="input" value={size} onChange={(event)=>setSize(event.target.value)}><option value="4">4 teams</option><option value="8">8 teams</option></select></label><label className="space-y-2 text-sm font-bold">Start date<input type="date" className="input" value={startDate} onChange={(event)=>setStartDate(event.target.value)}/></label><button onClick={()=>void generate()} disabled={working||!selected} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50">{working?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Generate bracket</button></div></section>:<section className="overflow-x-auto rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="grid min-w-[760px] gap-6" style={{gridTemplateColumns:`repeat(${rounds.length},minmax(220px,1fr))`}}>{rounds.map((round)=><div key={round} className="space-y-4"><h2 className="text-center text-sm font-black uppercase tracking-widest text-primary">{roundTitle(round)}</h2><div className="flex h-full flex-col justify-around gap-5">{matches.filter((match)=>match.bracket_round===round).map((match)=><article key={match.id} className="rounded-xl border border-border bg-background p-4 shadow-sm"><TeamRow item={team(match.team_a_id)} winner={match.winner_id===match.team_a_id}/><div className="my-2 border-t border-dashed border-border"/><TeamRow item={team(match.team_b_id)} winner={match.winner_id===match.team_b_id}/><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold uppercase text-muted-foreground">{match.status}</span><Link href={`/admin/matches/score/${match.id}`} className="inline-flex items-center gap-1 text-xs font-black text-primary"><PlayCircle className="h-3.5 w-3.5"/>Open</Link></div></article>)}</div></div>)}</div></section>}</div>;
}

function TeamRow({item,winner}:{item:Team|undefined;winner:boolean}){return <div className={`flex items-center gap-3 rounded-lg p-2 ${winner?"bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100":""}`}>{item?.logo_url?<img src={item.logo_url} alt="" className="h-8 w-8 rounded-full bg-white object-contain p-0.5"/>:<span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-black">{item?.name?.slice(0,1)||"?"}</span>}<strong className="min-w-0 flex-1 truncate text-sm">{item?.name||"TBD"}</strong>{winner&&<Trophy className="h-4 w-4 text-amber-500"/>}</div>}
