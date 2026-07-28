"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { PublicNav } from "@/components/public-nav";

type Team = { id: string; name: string; logo_url: string | null };
type Match = { id: string; team_a_id: string; team_b_id: string; status: string; match_date: string | null; match_time: string | null; ground: string | null; overs_per_match: number; match_scope: "tournament" | "standalone"; match_type: string; title: string | null };

export default function FixturesPage() {
  const t = useTranslations("Fixtures");
  const common = useTranslations("Common");
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    void (async () => {
      const [{ data: matchRows }, { data: teamRows }] = await Promise.all([
        (supabase.from("matches") as any).select("id,team_a_id,team_b_id,status,match_date,match_time,ground,overs_per_match,match_scope,match_type,title").eq("is_public", true).order("match_date"),
        (supabase.from("teams") as any).select("id,name,logo_url"),
      ]);
      setMatches(matchRows || []);
      setTeams(teamRows || []);
    })();
  }, []);
  const team = (id: string) => teams.find((item) => item.id === id);
  const statusLabel = (status: string) => ["live", "scheduled", "completed"].includes(status) ? common(status as "live" | "scheduled" | "completed") : status.replaceAll("_", " ");

  return <><PublicNav /><main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-7">
    <div><p className="text-sm font-bold uppercase tracking-widest text-sky-600">{t("eyebrow")}</p><h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">{t("title")}</h1><p className="mt-1 text-slate-500 dark:text-slate-300">{t("description")}</p></div>
    {matches.length ? matches.map((match) => <article key={match.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-sky-900 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${match.status === "live" ? "bg-red-50 text-red-600" : "bg-sky-50 text-sky-700"}`}>{match.status === "live" && <Radio className="h-3.5 w-3.5" />}{statusLabel(match.status).toUpperCase()}</span><span className="text-sm text-slate-500 dark:text-slate-300">{match.match_date || t("dateTbc")}{match.match_time ? ` · ${match.match_time}` : ""}</span></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamMark team={team(match.team_a_id)} /><strong className="text-slate-400">VS</strong><TeamMark team={team(match.team_b_id)} /></div>
      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-300">{match.ground || t("venueTbc")} · {match.overs_per_match} {t("overs")}</p>
      <div className="mt-4 flex justify-center gap-3"><Link href={`/match/${match.id}`} className="rounded-lg bg-gradient-to-r from-sky-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white">{t("liveView")}</Link><Link href={`/match/${match.id}/scorecard`} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-bold text-sky-800 dark:text-sky-200">{t("scorecard")}</Link></div>
    </article>) : <div className="rounded-2xl border border-dashed border-sky-200 p-10 text-center text-slate-500"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-sky-500" />{t("empty")}</div>}
  </main></>;
}

function TeamMark({ team }: { team?: Team }) {
  return <div className="min-w-0"><div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-sky-50">{team?.logo_url ? <img src={team.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="font-black text-sky-700">{team?.name?.slice(0, 1) || "T"}</span>}</div><p className="mt-2 truncate font-bold text-slate-900 dark:text-slate-50">{team?.name || "Team"}</p></div>;
}
