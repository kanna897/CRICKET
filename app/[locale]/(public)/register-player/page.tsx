"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Loader2, Upload, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cloudinaryPlayerPhotoUrl } from "@/lib/media";

type Tournament = { id: string; name: string };
type Team = { id: string; name: string; tournament_id: string };
type UploadSignature = { cloudName: string; apiKey: string; folder: string; timestamp: string; signature: string; error?: string };
type CloudinaryUpload = { secure_url?: string; error?: { message?: string } };
const initial = { tournament_id: "", preferred_team_id: "", player_name: "", contact_number: "", playing_role: "batsman", batting_style: "right_hand", bowling_style: "none", jersey_name: "", jersey_number: "", consent_given: false };

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok ? "The server returned an invalid response." : text.slice(0, 180));
  }
}

export default function PublicPlayerRegistrationPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState<number | null>(null);
  const playerCardUrl = "";
  useEffect(() => { void (async () => {
    const { data: tournamentRows } = await supabase.from("tournaments").select("id,name").eq("player_registration_enabled", true).is("deleted_at", null).order("name");
    const rows = (tournamentRows || []) as Tournament[];
    setTournaments(rows);
    if (rows.length) {
      setForm((current) => ({ ...current, tournament_id: rows[0].id }));
      const { data: teamRows } = await supabase.from("teams").select("id,name,tournament_id").in("tournament_id", rows.map((row) => row.id)).is("deleted_at", null).order("name");
      setTeams((teamRows || []) as Team[]);
    }
  })(); }, []);
  const availableTeams = useMemo(() => teams.filter((team) => team.tournament_id === form.tournament_id), [teams, form.tournament_id]);
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!photo) return setMessage("Profile photo is required.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      return setMessage("Upload a JPG, PNG or WebP image smaller than 5 MB.");
    }
    if (!form.consent_given) return setMessage("Please accept the consent declaration.");
    setSaving(true);
    try {
      const signatureRequest = new FormData();
      signatureRequest.set("tournamentId", form.tournament_id);
      const signatureResponse = await fetch("/api/media/player-registration", { method: "POST", body: signatureRequest });
      const signature = await readJson<UploadSignature>(signatureResponse);
      if (!signatureResponse.ok) throw new Error(signature.error || "Player photo upload authorization failed.");

      const cloudinaryForm = new FormData();
      cloudinaryForm.set("file", photo);
      cloudinaryForm.set("folder", signature.folder);
      cloudinaryForm.set("timestamp", signature.timestamp);
      cloudinaryForm.set("api_key", signature.apiKey);
      cloudinaryForm.set("signature", signature.signature);
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: "POST", body: cloudinaryForm },
      );
      const upload = await readJson<CloudinaryUpload>(uploadResponse);
      if (!uploadResponse.ok || !upload.secure_url) {
        throw new Error(upload.error?.message || "Player photo upload failed.");
      }

      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
      const registrationId = crypto.randomUUID();
      const { error } = await supabase.from("player_registrations").insert({
        id: registrationId,
        ...form,
        preferred_team_id: form.preferred_team_id || null,
        jersey_number: Number(form.jersey_number),
        photo_url: cloudinaryPlayerPhotoUrl(upload.secure_url),
        status: "pending",
        tracking_code: code,
      });
      if (error) throw error;
      setTrackingCode(code);
      localStorage.setItem("crickpulse-player-registration", JSON.stringify({ code, contact: form.contact_number }));
      setSubmitted(true);
      const { data: savedRegistration } = await supabase.rpc("get_registration_card_payload", {
        p_registration_id: registrationId,
        p_tracking_code: code,
      });
      if (typeof savedRegistration?.[0]?.registration_number === "number") {
        setRegistrationNumber(savedRegistration[0].registration_number);
      }
    } catch (reason) {
      const failure = reason as { message?: string };
      const duplicate = (reason as { code?: string }).code === "23505";
      setMessage(duplicate ? "Ã Â®â€¡Ã Â®Â¨Ã Â¯ÂÃ Â®Â¤ contact number-Ã Â®â€¢Ã Â¯ÂÃ Â®â€¢Ã Â¯Â already pending/approved registration Ã Â®â€¡Ã Â®Â°Ã Â¯ÂÃ Â®â€¢Ã Â¯ÂÃ Â®â€¢Ã Â¯Â." : (failure?.message || "Registration could not be submitted."));
    } finally { setSaving(false); }
  }

  if (submitted) return <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center p-5"><section className="w-full rounded-3xl border border-emerald-300 bg-emerald-50 p-8 text-center text-emerald-950 shadow-xl dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600"/><h1 className="mt-4 text-3xl font-black">Registration submitted</h1><p className="mt-2">Organizer approval Ã Â®ÂªÃ Â®Â¿Ã Â®Â±Ã Â®â€¢Ã Â¯Â player directory-Ã Â®Â²Ã Â¯Â Ã Â®Å¡Ã Â¯â€¡Ã Â®Â°Ã Â¯ÂÃ Â®â€¢Ã Â¯ÂÃ Â®â€¢Ã Â®ÂªÃ Â¯ÂÃ Â®ÂªÃ Â®Å¸Ã Â¯ÂÃ Â®Â®Ã Â¯Â.</p><div className="mx-auto mt-6 max-w-sm"><div className="rounded-2xl border border-emerald-300 bg-white/70 p-4 dark:bg-black/20"><p className="text-xs font-black uppercase tracking-widest">Registration number</p><p className="mt-2 font-mono text-4xl font-black">{registrationNumber === null ? "GeneratingÃ¢â‚¬Â¦" : String(registrationNumber).padStart(2, "0")}</p><p className="mt-5 text-xs font-black uppercase tracking-widest">Tracking code</p><p className="mt-2 font-mono text-2xl font-black tracking-wider">{trackingCode}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(trackingCode)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500 px-3 py-2 text-sm font-bold"><Clipboard className="h-4 w-4"/>Copy code</button></div>{playerCardUrl ? <a href={playerCardUrl} download className="group overflow-hidden rounded-2xl border border-emerald-300 bg-white p-2 text-left"><img src={playerCardUrl} alt="Generated player profile card" className="aspect-square w-full rounded-xl object-cover"/><span className="mt-2 block text-center text-sm font-black text-emerald-800">Download Player Card JPG</span></a> : <div className="hidden">Player card will be generated when an active tournament template is selected.</div>}</div><p className="mt-4 text-sm">Ã Â®â€¡Ã Â®Â¨Ã Â¯ÂÃ Â®Â¤ tracking code + contact number save Ã Â®Å¡Ã Â¯â€ Ã Â®Â¯Ã Â¯ÂÃ Â®Â¯Ã Â¯ÂÃ Â®â„¢Ã Â¯ÂÃ Â®â€¢Ã Â®Â³Ã Â¯Â; registration status Ã Â®ÂªÃ Â®Â¾Ã Â®Â°Ã Â¯ÂÃ Â®â€¢Ã Â¯ÂÃ Â®â€¢ Ã Â®â€¡Ã Â®Â¤Ã Â¯Â Ã Â®Â¤Ã Â¯â€¡Ã Â®ÂµÃ Â¯Ë†.</p></section></main>;
  if (!tournaments.length) return <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center p-5"><section className="w-full rounded-3xl border border-border bg-card p-8 text-center text-foreground shadow-xl"><UserPlus className="mx-auto h-12 w-12 text-muted-foreground"/><h1 className="mt-4 text-3xl font-black">Player registration is currently closed</h1><p className="mt-2 text-muted-foreground">An organizer can unhide this feature from Tournament Settings.</p></section></main>;

  return <main className="player-registration-page mx-auto max-w-5xl p-4 py-8 sm:p-7"><header className="player-registration-hero mb-6 overflow-hidden rounded-3xl border p-6 sm:p-8"><span className="registration-hero-icon"><UserPlus/></span><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Join the competition</p><h1 className="mt-1 text-4xl font-black text-white">Player Registration</h1><p className="mt-2 max-w-2xl text-slate-300">Create your cricket identity and submit it securely for organizer approval.</p></div></header><form onSubmit={submit} className="player-registration-form space-y-7 rounded-3xl border border-border bg-card p-5 text-foreground shadow-2xl sm:p-8">{message && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:bg-red-950/40 dark:text-red-200">{message}</p>}<section><SectionTitle number="01" title="Personal identity" text="Basic details used for your player profile."/><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Player name"><input required minLength={2} className="input" placeholder="Full player name" value={form.player_name} onChange={(e)=>update("player_name",e.target.value)}/></Field><Field label="Contact number"><input required minLength={7} className="input" placeholder="+94 7X XXX XXXX" value={form.contact_number} onChange={(e)=>update("contact_number",e.target.value)}/></Field><Field label="Profile photo (JPG, PNG or WebP Ã‚Â· max 5MB)"><label className="registration-photo-picker"><span className="registration-photo-preview">{photo?<img src={URL.createObjectURL(photo)} alt="Selected player"/>:<UserPlus/>}</span><span><strong>{photo?.name || "Choose profile photo"}</strong><small>Square portrait recommended</small></span><Upload className="ml-auto h-5 w-5"/><input required type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e)=>setPhoto(e.target.files?.[0]||null)}/></label></Field><Field label="Jersey identity"><div className="grid grid-cols-[1fr_7rem] gap-2"><input required maxLength={30} className="input" placeholder="Jersey name" value={form.jersey_name} onChange={(e)=>update("jersey_name",e.target.value)}/><input aria-label="Jersey number" required type="number" min="0" max="999" className="input" placeholder="No." value={form.jersey_number} onChange={(e)=>update("jersey_number",e.target.value)}/></div><small className="mt-1 block text-muted-foreground">Same jersey number is allowed.</small></Field></div></section><section className="border-t border-border pt-7"><SectionTitle number="02" title="Cricket profile" text="Playing preferences shown to selectors."/><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Playing role"><select className="input" value={form.playing_role} onChange={(e)=>update("playing_role",e.target.value)}><option value="batsman">Batsman</option><option value="bowler">Bowler</option><option value="all_rounder">All-rounder</option><option value="wicket_keeper">Wicket keeper</option></select></Field><Field label="Batting style"><select className="input" value={form.batting_style} onChange={(e)=>update("batting_style",e.target.value)}><option value="right_hand">Right hand</option><option value="left_hand">Left hand</option></select></Field><Field label="Bowling style"><select className="input" value={form.bowling_style} onChange={(e)=>update("bowling_style",e.target.value)}><option value="none">Not specified</option><option value="right_arm_fast">Right-arm fast</option><option value="left_arm_fast">Left-arm fast</option><option value="off_spin">Off spin</option><option value="leg_spin">Leg spin</option><option value="left_arm_spin">Left-arm spin</option></select></Field></div></section><section className="border-t border-border pt-7"><SectionTitle number="03" title="Tournament selection" text="Choose where you would like to compete."/><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Tournament"><select required className="input" value={form.tournament_id} onChange={(e)=>{update("tournament_id",e.target.value);update("preferred_team_id","");}}>{tournaments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Preferred team"><select className="input" value={form.preferred_team_id} onChange={(e)=>update("preferred_team_id",e.target.value)}><option value="">Organizer can assign</option>{availableTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field></div></section><label className="registration-consent flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4"><input required type="checkbox" checked={form.consent_given} onChange={(e)=>update("consent_given",e.target.checked)} className="mt-1 h-5 w-5 accent-primary"/><span className="text-sm"><strong>Consent:</strong> I confirm these details are correct and allow the tournament organizer to use them for team selection, scorecards and player profiles.</span></label><button disabled={saving} className="registration-submit flex min-h-14 w-full items-center justify-center rounded-xl px-5 text-base font-black disabled:opacity-50">{saving&&<Loader2 className="mr-2 h-5 w-5 animate-spin"/>}Submit Registration</button></form></main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-2 text-sm font-bold text-foreground"><span className="block">{label}</span>{children}</label>}
function SectionTitle({number,title,text}:{number:string;title:string;text:string}){return <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-xs font-black text-primary-foreground">{number}</span><div><h2 className="text-lg font-black text-foreground">{title}</h2><p className="text-sm text-muted-foreground">{text}</p></div></div>}
