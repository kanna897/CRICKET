"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PublicNav } from "@/components/public-nav";
import { useTranslations } from "next-intl";

type Team = { id: string; name: string; logo_url: string | null };
type Player = { id: string; name: string; photo_url: string | null; playing_role: string | null; batting_style: string | null; bowling_style: string | null };

export default function PublicTeamPage() {
  const t = useTranslations("TeamDetail");
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [{ data: teamRow }, { data: playerRows }] = await Promise.all([
        supabase.from("teams").select("id,name,logo_url").eq("id", id).maybeSingle(),
        supabase.from("players").select("id,name,photo_url,playing_role,batting_style,bowling_style").eq("team_id", id).order("name"),
      ]);
      setTeam(teamRow);
      setPlayers(playerRows || []);
    })();
  }, [id]);

  return <><PublicNav /><main className="mx-auto max-w-4xl p-4 sm:p-7">
    <Link href="/teams" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-sky-700"><ArrowLeft className="h-4 w-4" />{t("allTeams")}</Link>
    <header className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 p-5">{team?.logo_url ? <img src={team.logo_url} alt="" className="h-16 w-16 rounded-full bg-white object-contain p-0.5" /> : null}<div><p className="text-xs font-black uppercase tracking-widest text-sky-600">{t("squad")}</p><h1 className="text-3xl font-black text-slate-900">{team?.name || t("team")}</h1></div></header>
    <div className="grid gap-3 sm:grid-cols-2">{players.map((player) => <button key={player.id} onClick={() => setSelected(player)} className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white p-4 text-left shadow-sm transition hover:border-sky-300"><PlayerAvatar player={player} /><span className="min-w-0"><span className="flex min-w-0 items-center font-black text-slate-900"><span className="truncate">{player.name}</span><RoleMark role={player.playing_role} /></span><span className="text-sm text-slate-500">{player.playing_role || "Player"}</span></span></button>)}</div>
    {!players.length&&<p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{t("empty")}</p>}
  </main>{selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><button onClick={() => setSelected(null)} className="absolute right-4 top-4 text-slate-500"><X className="h-5 w-5" /></button><div className="flex flex-col items-center text-center"><PlayerAvatar player={selected} large /><p className="mt-3 flex items-center text-2xl font-black text-slate-900">{selected.name}<RoleMark role={selected.playing_role} /></p><p className="mt-1 rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700">{selected.playing_role || t("player")}</p><div className="mt-5 grid w-full grid-cols-2 gap-3 text-left text-sm"><Info label={t("batting")} value={selected.batting_style} /><Info label={t("bowling")} value={selected.bowling_style} /></div><Link href={`/players/${selected.id}`} className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 font-black text-white">{t("fullProfile")}</Link></div></div></div>}</>;
}

function PlayerAvatar({ player, large = false }: { player: Player; large?: boolean }) {
  const size = large ? "h-24 w-24 text-3xl" : "h-11 w-11";
  return player.photo_url ? <img src={player.photo_url} alt="" className={`${size} shrink-0 rounded-full border border-sky-200 object-cover`} /> : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 font-black text-sky-700`}>{player.name.slice(0, 1)}</span>;
}

function RoleMark({ role }: { role: string | null }) {
  const value = (role || "").toLowerCase();
  const symbol = value.includes("wicket") ? "🧤" : value.includes("all") ? "🏏🔴" : value.includes("bowl") ? "🔴" : "🏏";
  return <span className="ml-3 inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50 px-1.5 text-base leading-none" title={role || "Player"}>{symbol}</span>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-700">{value || "—"}</p></div>;
}
