"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Link2, Loader2, MapPin, Plus, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAccess } from "@/components/admin-shell";

type Club = { id:string; organizer_id:string; name:string; short_name:string|null; location:string|null; website_url:string|null; social_url:string|null; created_at:string };
type Season = { id:string; club_id:string; name:string; start_date:string|null; end_date:string|null; status:"upcoming"|"active"|"completed"; created_at:string };
type Tournament = { id:string; name:string; club_id:string|null; season_id:string|null; organizer_id:string };

export default function ClubsPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [clubs,setClubs] = useState<Club[]>([]);
  const [seasons,setSeasons] = useState<Season[]>([]);
  const [tournaments,setTournaments] = useState<Tournament[]>([]);
  const [selectedClubId,setSelectedClubId] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [clubForm,setClubForm] = useState({name:"",short_name:"",location:"",website_url:"",social_url:""});
  const [seasonForm,setSeasonForm] = useState({name:new Date().getFullYear().toString(),start_date:"",end_date:"",status:"active" as Season["status"]});
  const [assignment,setAssignment] = useState({tournament_id:"",season_id:""});

  const load = useCallback(async () => {
    setLoading(true);
    let clubQuery = supabase.from("clubs").select("*").order("created_at",{ascending:false});
    let tournamentQuery = supabase.from("tournaments").select("id,name,club_id,season_id,organizer_id").is("deleted_at",null).order("created_at",{ascending:false});
    if (!isMasterAdmin) { clubQuery=clubQuery.eq("organizer_id",userId); tournamentQuery=tournamentQuery.eq("organizer_id",userId); }
    const [clubResult,seasonResult,tournamentResult] = await Promise.all([clubQuery,supabase.from("club_seasons").select("*").order("start_date",{ascending:false}),tournamentQuery]);
    if (clubResult.error) setError(clubResult.error.message);
    setClubs(clubResult.data||[]); setSeasons(seasonResult.data||[]); setTournaments(tournamentResult.data||[]);
    setSelectedClubId(current=>current||clubResult.data?.[0]?.id||""); setLoading(false);
  },[isMasterAdmin,userId]);
  useEffect(()=>{ void load(); },[load]);

  const selectedClub=clubs.find(club=>club.id===selectedClubId)||null;
  const selectedSeasons=useMemo(()=>seasons.filter(season=>season.club_id===selectedClubId),[seasons,selectedClubId]);
  const selectedTournaments=tournaments.filter(tournament=>tournament.club_id===selectedClubId);
  const assignableTournaments=tournaments.filter(tournament=>!tournament.club_id||tournament.club_id===selectedClubId);

  async function createClub(event:React.FormEvent) {
    event.preventDefault(); if(!clubForm.name.trim()) return; setSaving(true); setError("");
    const {error:insertError}=await supabase.from("clubs").insert({organizer_id:userId,name:clubForm.name.trim(),short_name:clubForm.short_name.trim()||null,location:clubForm.location.trim()||null,website_url:clubForm.website_url.trim()||null,social_url:clubForm.social_url.trim()||null});
    if(insertError) setError(insertError.message); else { setClubForm({name:"",short_name:"",location:"",website_url:"",social_url:""}); await load(); } setSaving(false);
  }
  async function createSeason(event:React.FormEvent) {
    event.preventDefault(); if(!selectedClubId||!seasonForm.name.trim()) return; setSaving(true); setError("");
    const {error:insertError}=await supabase.from("club_seasons").insert({club_id:selectedClubId,name:seasonForm.name.trim(),start_date:seasonForm.start_date||null,end_date:seasonForm.end_date||null,status:seasonForm.status});
    if(insertError) setError(insertError.message); else { setSeasonForm({name:String(new Date().getFullYear()+1),start_date:"",end_date:"",status:"upcoming"}); await load(); } setSaving(false);
  }
  async function assignTournament(event:React.FormEvent) {
    event.preventDefault(); if(!selectedClubId||!assignment.tournament_id||!assignment.season_id) return; setSaving(true); setError("");
    const {error:updateError}=await supabase.from("tournaments").update({club_id:selectedClubId,season_id:assignment.season_id}).eq("id",assignment.tournament_id);
    if(updateError) setError(updateError.message); else { setAssignment({tournament_id:"",season_id:""}); await load(); } setSaving(false);
  }

  return <div className="admin-themed-page space-y-6">
    <div><h1 className="text-3xl font-black tracking-tight">Clubs & Seasons</h1><p className="mt-1 text-muted-foreground">Build a permanent club history across seasons and tournaments.</p></div>
    {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div>}
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-xl font-black"><Building2 className="h-5 w-5 text-primary"/>Club directory</h2>{loading?<Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-primary"/>:clubs.length?<div className="mt-4 grid gap-3 sm:grid-cols-2">{clubs.map(club=><button key={club.id} onClick={()=>setSelectedClubId(club.id)} className={`rounded-xl border p-4 text-left transition ${club.id===selectedClubId?"border-primary bg-primary/10 ring-1 ring-primary":"border-border hover:bg-muted"}`}><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">{(club.short_name||club.name).slice(0,3).toUpperCase()}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">{seasons.filter(season=>season.club_id===club.id).length} seasons</span></div><h3 className="mt-3 font-black">{club.name}</h3>{club.location&&<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3"/>{club.location}</p>}</button>)}</div>:<div className="py-12 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-10 w-10"/><p>No clubs created yet.</p></div>}</div>
      <form onSubmit={createClub} className="space-y-4 rounded-2xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5 text-primary"/>Create club</h2><Field label="Club name"><input required value={clubForm.name} onChange={e=>setClubForm({...clubForm,name:e.target.value})} className="input" placeholder="Jaffna Cricket Club"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Short name"><input value={clubForm.short_name} onChange={e=>setClubForm({...clubForm,short_name:e.target.value})} className="input" placeholder="JCC"/></Field><Field label="Location"><input value={clubForm.location} onChange={e=>setClubForm({...clubForm,location:e.target.value})} className="input" placeholder="Jaffna"/></Field></div><Field label="Website"><input type="url" value={clubForm.website_url} onChange={e=>setClubForm({...clubForm,website_url:e.target.value})} className="input" placeholder="https://…"/></Field><Field label="Social link"><input type="url" value={clubForm.social_url} onChange={e=>setClubForm({...clubForm,social_url:e.target.value})} className="input" placeholder="https://…"/></Field><SaveButton saving={saving} label="Create club"/></form>
    </section>
    {selectedClub&&<section className="space-y-5 rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Selected club</p><h2 className="text-2xl font-black">{selectedClub.name}</h2></div><div className="flex gap-2">{selectedClub.website_url&&<a href={selectedClub.website_url} target="_blank" rel="noreferrer" className="control"><Link2 className="mr-1 h-4 w-4"/>Website</a>}{selectedClub.social_url&&<a href={selectedClub.social_url} target="_blank" rel="noreferrer" className="control">Social</a>}</div></div>
      <div className="grid gap-5 lg:grid-cols-2"><form onSubmit={createSeason} className="space-y-4 rounded-xl border border-border p-4"><h3 className="flex items-center gap-2 font-black"><CalendarDays className="h-5 w-5 text-primary"/>Add season</h3><Field label="Season name"><input required value={seasonForm.name} onChange={e=>setSeasonForm({...seasonForm,name:e.target.value})} className="input" placeholder="2026 / Premier Season"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Start"><input type="date" value={seasonForm.start_date} onChange={e=>setSeasonForm({...seasonForm,start_date:e.target.value})} className="input"/></Field><Field label="End"><input type="date" value={seasonForm.end_date} onChange={e=>setSeasonForm({...seasonForm,end_date:e.target.value})} className="input"/></Field></div><Field label="Status"><select value={seasonForm.status} onChange={e=>setSeasonForm({...seasonForm,status:e.target.value as Season["status"]})} className="input"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></Field><SaveButton saving={saving} label="Add season"/></form>
      <form onSubmit={assignTournament} className="space-y-4 rounded-xl border border-border p-4"><h3 className="flex items-center gap-2 font-black"><Trophy className="h-5 w-5 text-primary"/>Assign tournament</h3><Field label="Tournament"><select required value={assignment.tournament_id} onChange={e=>setAssignment({...assignment,tournament_id:e.target.value})} className="input"><option value="">Select tournament</option>{assignableTournaments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Season"><select required value={assignment.season_id} onChange={e=>setAssignment({...assignment,season_id:e.target.value})} className="input"><option value="">Select season</option>{selectedSeasons.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><SaveButton saving={saving} label="Assign tournament"/></form></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedSeasons.map(season=><article key={season.id} className="rounded-xl border border-border bg-background/50 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-black">{season.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-black ${season.status==="active"?"bg-green-100 text-green-800":"bg-muted text-muted-foreground"}`}>{season.status}</span></div><p className="mt-2 text-xs text-muted-foreground">{season.start_date||"Start TBC"} — {season.end_date||"Ongoing"}</p><p className="mt-3 text-sm font-bold">{selectedTournaments.filter(item=>item.season_id===season.id).length} tournament(s)</p></article>)}</div>
    </section>}
  </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-2 text-sm font-bold">{label}{children}</label>;}
function SaveButton({saving,label}:{saving:boolean;label:string}){return <button disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 font-black text-primary-foreground disabled:opacity-50">{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{label}</button>;}
