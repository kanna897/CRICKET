"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, UserCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Registration = { id:string; tournament_id:string; preferred_team_id:string|null; player_name:string; contact_number:string; photo_url:string; playing_role:string; batting_style:string; bowling_style:string; jersey_name:string; jersey_number:number; status:string; created_at:string };
type Named = { id:string; name:string };
const playerRole = (role:string) => role === "all_rounder" ? "all-rounder" : role === "wicket_keeper" ? "wicket-keeper" : role;

export default function PlayerRegistrationsPage(){
  const [rows,setRows]=useState<Registration[]>([]),[teams,setTeams]=useState<Named[]>([]),[tournaments,setTournaments]=useState<Named[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  const load=useCallback(async()=>{setLoading(true);const [r,t,tr]=await Promise.all([supabase.from("player_registrations").select("*").order("created_at",{ascending:false}),supabase.from("teams").select("id,name"),supabase.from("tournaments").select("id,name")]);setRows(r.data||[]);setTeams(t.data||[]);setTournaments(tr.data||[]);setLoading(false)},[]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const name=(list:Named[],id:string|null)=>list.find(x=>x.id===id)?.name||"Organizer assignment";
  async function review(row:Registration,approve:boolean){
    setBusy(row.id);
    try{
      if(approve){
        const {data:created,error}=await supabase.from("players").insert({name:row.player_name,player_name:row.player_name,phone_number:row.contact_number,contact_number:row.contact_number,photo_url:row.photo_url,playing_role:row.playing_role,role:playerRole(row.playing_role),batting_style:row.batting_style,bowling_style:row.bowling_style,jersey_name:row.jersey_name,jersey_number:row.jersey_number,team_id:row.preferred_team_id}).select("id").single();
        if(error)throw error;
        await supabase.from("auction_players").update({player_id:created.id}).eq("registration_id",row.id);
        (row as Registration & { player_id?: string }).player_id=created.id;
      }
      const {data:{user}}=await supabase.auth.getUser();
      const {error}=await supabase.from("player_registrations").update({status:approve?"approved":"rejected",player_id:(row as Registration & {player_id?:string}).player_id||null,reviewed_by:user?.id||null,reviewed_at:new Date().toISOString()}).eq("id",row.id);
      if(error)throw error;
      await load();
    }catch(e){const failure=e as {message?:string};alert(failure?.message||"Review failed.")}finally{setBusy("")}
  }
  return <div className="admin-themed-page space-y-6"><header><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Squad intake</p><h1 className="mt-1 text-3xl font-black text-foreground">Player Registrations</h1><p className="mt-1 text-muted-foreground">Approve or reject public player applications for tournaments you manage.</p></header>{loading?<div className="grid min-h-60 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>:!rows.length?<section className="rounded-3xl border border-border bg-card p-10 text-center"><UserCheck className="mx-auto h-12 w-12 text-muted-foreground"/><h2 className="mt-3 text-xl font-black">No registrations yet</h2></section>:<section className="grid gap-4 lg:grid-cols-2">{rows.map(row=><article key={row.id} className="rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm"><div className="flex gap-4"><Image unoptimized width={128} height={128} src={row.photo_url} alt="" className="h-20 w-20 rounded-2xl object-cover ring-2 ring-primary/20"/><div className="min-w-0"><span className={`rounded-full px-2 py-1 text-[.65rem] font-black uppercase ${row.status==="pending"?"bg-amber-100 text-amber-900":row.status==="approved"?"bg-emerald-100 text-emerald-900":"bg-red-100 text-red-900"}`}>{row.status}</span><h2 className="mt-2 truncate text-xl font-black">{row.player_name}</h2><p className="text-sm text-muted-foreground">{name(tournaments,row.tournament_id)}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 text-sm"><div><dt className="text-muted-foreground">Preferred team</dt><dd className="font-bold">{name(teams,row.preferred_team_id)}</dd></div><div><dt className="text-muted-foreground">Role</dt><dd className="font-bold capitalize">{row.playing_role.replaceAll("_"," ")}</dd></div><div><dt className="text-muted-foreground">Jersey</dt><dd className="font-bold">{row.jersey_name} · {row.jersey_number}</dd></div><div><dt className="text-muted-foreground">Contact</dt><dd className="font-bold">{row.contact_number}</dd></div></dl>{row.status==="pending"&&<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>void review(row,false)} disabled={busy===row.id} className="control justify-center border-red-300 text-red-600 dark:text-red-300"><X className="mr-2 h-4 w-4"/>Reject</button><button onClick={()=>void review(row,true)} disabled={busy===row.id} className="control justify-center bg-emerald-600 text-white"><Check className="mr-2 h-4 w-4"/>Approve & Add</button></div>}</article>)}</section>}</div>
}
