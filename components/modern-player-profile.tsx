import Image from "next/image";
import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { Activity, ArrowLeft, CalendarDays, Camera, Hash, Loader2, Pencil, Phone, Shield, Target, Trash2, Trophy, User } from "lucide-react";
import type { Database } from "@/types/database.types";

type Player = Database["public"]["Tables"]["players"]["Row"];
type Team = Database["public"]["Tables"]["teams"]["Row"];

interface ModernPlayerProfileProps {
  player: Player;
  teams: Team[];
  playerCode: string;
  career: CareerSnapshot;
  isUploading: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPhotoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export type CareerSnapshot = { matches: number; runs: number; wickets: number; highScore: number; average: number; catches: number; stumpings: number; runOuts: number; recentScores: number[] };

export function ModernPlayerProfile({ player, teams, playerCode, career, isUploading, isDeleting, onEdit, onDelete, onPhotoUpload }: ModernPlayerProfileProps) {
  const currentTeam = teams.find((team) => team.id === player.team_id);
  const initials = player.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const joinedDate = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(player.created_at));

  return (
    <div className="match-theme-surface relative mx-auto max-w-6xl space-y-6 overflow-hidden rounded-[2rem] border border-amber-200/30 bg-[radial-gradient(circle_at_top_right,#1c62ba_0%,#0a1f4a_46%,#050b26_100%)] p-4 pb-10 text-white shadow-2xl sm:p-6 sm:pb-10">
      <div className="pointer-events-none absolute -left-24 top-52 h-2 w-[32rem] -rotate-12 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent blur-sm" />
      <div className="pointer-events-none absolute -right-24 bottom-40 h-2 w-[32rem] -rotate-12 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent blur-sm" />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/players" aria-label="Back to players" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-slate-200 shadow-sm transition hover:-translate-x-0.5 hover:bg-white/15 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Squad management</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Player profile</h1></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-cyan-200/40 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 shadow-sm transition hover:bg-cyan-300/20 sm:flex-none"><Pencil className="mr-2 h-4 w-4" />Edit profile</button>
          <button type="button" onClick={onDelete} disabled={isDeleting} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50 sm:flex-none">{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete</button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/40 bg-[#06122d]/90 text-white shadow-2xl shadow-black/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.28),transparent_35%),radial-gradient(circle_at_10%_100%,rgba(34,197,94,0.2),transparent_38%)]" />
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[12rem] font-black leading-none text-white/[0.035] sm:text-[18rem]">{initials || "CP"}</div>
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-10">
          <div className="group relative mx-auto lg:mx-0">
            <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur sm:h-48 sm:w-48">
              {player.photo_url ? <Image src={player.photo_url} alt={player.name} fill sizes="192px" unoptimized className="object-cover" /> : <User className="h-16 w-16 text-white/50" />}
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="flex flex-col items-center gap-2 text-xs font-semibold"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/15">{isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}</span>Change photo</span>
                <input type="file" className="sr-only" accept="image/*" onChange={onPhotoUpload} disabled={isUploading} />
              </label>
            </div>
            <span className="absolute -bottom-2 -right-2 grid h-11 w-11 place-items-center rounded-2xl border-4 border-slate-950 bg-emerald-500 shadow-lg" aria-label="Active player"><Activity className="h-5 w-5" /></span>
          </div>

          <div className="text-center lg:text-left">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start"><span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300">{player.playing_role || "Squad player"}</span><span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">Active</span></div>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">{player.name}</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-white/65 lg:justify-start"><span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-400" />{currentTeam?.name || "Unassigned squad"}</span><span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-sky-400" />{player.phone_number || "No contact number"}</span></div>
          </div>

          <div className="mx-auto rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center backdrop-blur lg:mx-0 lg:min-w-36"><p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/45">Player code</p><p className="mt-2 font-mono text-xl font-bold text-sky-300">{playerCode}</p><p className="mt-1 text-[.6rem] text-white/40">Registration order ID</p></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <section className="match-theme-adaptive-card overflow-hidden rounded-3xl border border-amber-200/30 bg-[#06122d]/95 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0d4e9c]/50 to-transparent px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Cricket profile</p><h3 className="mt-1 text-lg font-bold">Playing information</h3></div><Target className="h-5 w-5 text-cyan-200" /></div>
            <div className="grid sm:grid-cols-2">
              <ProfileDetail icon={<Activity className="h-5 w-5" />} label="Primary role" value={player.playing_role || "Not specified"} />
              <ProfileDetail icon={<Shield className="h-5 w-5" />} label="Current team" value={currentTeam?.name || "Unassigned"} />
              <ProfileDetail icon={<Target className="h-5 w-5" />} label="Batting style" value={player.batting_style || "Not specified"} />
              <ProfileDetail icon={<Trophy className="h-5 w-5" />} label="Bowling style" value={player.bowling_style || "Not specified"} />
            </div>
          </section>

          <section className="match-theme-adaptive-card rounded-3xl border border-amber-200/30 bg-[#06122d]/95 p-6 shadow-xl shadow-black/20">
            <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Performance</p><h3 className="mt-1 text-lg font-bold">Career snapshot</h3></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Matches", career.matches], ["Runs", career.runs], ["Wickets", career.wickets], ["High score", career.highScore]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d2b59] to-[#071735] p-4 shadow-inner"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-100/70">{label}</p><p className="mt-2 text-3xl font-black tracking-tight text-amber-100">{value}</p></div>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniMetric label="Batting average" value={career.average.toFixed(1)} /><MiniMetric label="Catches" value={career.catches} /><MiniMetric label="Stumpings" value={career.stumpings} /><MiniMetric label="Run outs" value={career.runOuts} /></div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Recent batting form</p><span className="text-[.65rem] text-slate-400">Latest innings</span></div><div className="mt-3 flex flex-wrap gap-2">{career.recentScores.length ? career.recentScores.map((score, index) => <span key={`${score}-${index}`} className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 font-black text-cyan-100">{score}</span>) : <span className="text-xs text-slate-400">No recorded innings yet.</span>}</div></div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="match-theme-adaptive-card rounded-3xl border border-amber-200/30 bg-[#06122d]/95 p-6 shadow-xl shadow-black/20"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Profile record</p><h3 className="mt-1 text-lg font-bold">Account details</h3><div className="mt-6 space-y-5"><MetaRow icon={<Hash className="h-4 w-4" />} label="Player ID" value={playerCode} mono /><MetaRow icon={<Phone className="h-4 w-4" />} label="Contact" value={player.phone_number || "Not provided"} /><MetaRow icon={<CalendarDays className="h-4 w-4" />} label="Added on" value={joinedDate} /></div></section>
          <section className="rounded-3xl border border-cyan-200/30 bg-gradient-to-br from-cyan-300/15 to-[#06122d] p-6 shadow-xl"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#06122d]"><Shield className="h-5 w-5" /></span><div><h3 className="font-bold text-amber-100">Player ready</h3><p className="mt-1 text-sm leading-6 text-slate-300">Profile is active and available for team selection and match line-ups.</p></div></div></section>
        </aside>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.04] p-3"><p className="text-[.65rem] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-emerald-300">{value}</p></div>;
}

function ProfileDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-4 border-b border-white/10 p-6 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:border-r sm:odd:border-white/10"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate font-semibold text-slate-100">{value}</p></div></div>;
}

function MetaRow({ icon, label, value, mono = false }: { icon: ReactNode; label: string; value: string; mono?: boolean }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-cyan-200">{icon}</span><div className="min-w-0"><p className="text-xs font-medium text-slate-400">{label}</p><p className={`mt-1 break-all text-sm font-semibold text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</p></div></div>;
}
