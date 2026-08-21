"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PublicNav } from "@/components/public-nav";

type Team = { id: string; name: string; logo_url: string | null };
type Match = { id: string; tournament_id: string | null; team_a_id: string; team_b_id: string; status: string; match_date: string | null; match_time: string | null; ground: string | null; overs_per_match: number; match_scope: string; match_type: string; title: string | null; fixture_round: number | null; match_number: number | null; tournament_name: string | null };
type DateGroup = { id: string; label: string; matches: Match[] };

export default function FixturesClient({ initialMatches, initialTeams }: { initialMatches: Match[]; initialTeams: Team[] }) {
  const t = useTranslations("Fixtures");
  const common = useTranslations("Common");
  const team = (id: string) => initialTeams.find((item) => item.id === id);
  const statusLabel = (status: string) => ["live", "scheduled", "completed"].includes(status) ? common(status as "live" | "scheduled" | "completed") : status.replaceAll("_", " ");
  const dateGroups = fixtureDateGroups(initialMatches, t("dateTbc"));
  const [selectedDate, setSelectedDate] = useState(() => dateGroups[0]?.id || "");
  const selectedDateIndex = dateGroups.findIndex((group) => group.id === selectedDate);
  const activeDateGroup = dateGroups[selectedDateIndex] || dateGroups[0];

  return <><PublicNav /><main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-7">
    <div><p className="text-sm font-bold uppercase tracking-widest text-sky-600">{t("eyebrow")}</p><h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">{t("title")}</h1><p className="mt-1 text-slate-500 dark:text-slate-300">{t("description")}</p></div>
    {dateGroups.length ? <>
      <section className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-900 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" aria-label="Previous match date" disabled={selectedDateIndex <= 0} onClick={() => setSelectedDate(dateGroups[selectedDateIndex - 1].id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-200 px-3 text-sm font-black text-sky-800 disabled:opacity-40 dark:border-sky-800 dark:text-sky-200"><ChevronLeft className="mr-1 h-4 w-4"/>Previous</button>
        <label className="min-w-0 flex-1 text-center text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Match date<select aria-label="Select match date" value={activeDateGroup?.id || ""} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-sky-200 bg-white px-3 text-center text-sm font-black text-slate-900 dark:border-sky-800 dark:bg-slate-950 dark:text-slate-50">{dateGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
        <button type="button" aria-label="Next match date" disabled={selectedDateIndex < 0 || selectedDateIndex >= dateGroups.length - 1} onClick={() => setSelectedDate(dateGroups[selectedDateIndex + 1].id)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-sky-200 px-3 text-sm font-black text-sky-800 disabled:opacity-40 dark:border-sky-800 dark:text-sky-200">Next<ChevronRight className="ml-1 h-4 w-4"/></button>
      </section>
      {activeDateGroup && <section className="space-y-4"><h2 className="rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-4 text-center text-xl font-black text-white shadow-lg">{activeDateGroup.label}</h2>{activeDateGroup.matches.map((match) => <article key={match.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-sky-900 dark:bg-slate-950">
          <div className="mb-3 flex items-center justify-between"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${match.status === "live" ? "bg-red-50 text-red-600" : "bg-sky-50 text-sky-700"}`}>{match.status === "live" && <Radio className="h-3.5 w-3.5" />}{statusLabel(match.status).toUpperCase()}</span><span className="text-sm text-slate-500 dark:text-slate-300">{match.match_date || t("dateTbc")}{match.match_time ? ` · ${match.match_time}` : ""}</span></div>
          <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-sky-600">{match.tournament_name || match.title || "Independent match"}{match.fixture_round ? ` · Round ${match.fixture_round}` : ""}</p>
          {match.match_number && <p className="mb-3 text-center font-mono text-xs font-black uppercase tracking-widest text-sky-600">Match {match.match_number}</p>}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><TeamMark team={team(match.team_a_id)} /><strong className="text-slate-400">VS</strong><TeamMark team={team(match.team_b_id)} /></div>
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-300">{match.ground || t("venueTbc")} · {match.overs_per_match} {t("overs")}</p>
          <div className="mt-4 flex justify-center gap-3"><Link href={`/match/${match.id}`} className="rounded-lg bg-gradient-to-r from-sky-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white">{t("liveView")}</Link><Link href={`/match/${match.id}/scorecard`} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-bold text-sky-800 dark:text-sky-200">{t("scorecard")}</Link></div>
        </article>)}</section>}
    </> : <div className="rounded-2xl border border-dashed border-sky-200 p-10 text-center text-slate-500"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-sky-500" />{t("empty")}</div>}
  </main></>;
}

function fixtureDateGroups(matches: Match[], dateTbc: string): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const match of matches) {
    const id = match.match_date || "unscheduled";
    const current = groups.get(id) || { id, label: match.match_date ? formatFixtureDate(match.match_date) : dateTbc, matches: [] };
    current.matches.push(match);
    groups.set(id, current);
  }
  return [...groups.values()].sort((left, right) => left.id === "unscheduled" ? 1 : right.id === "unscheduled" ? -1 : left.id.localeCompare(right.id));
}

function formatFixtureDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function TeamMark({ team }: { team?: Team }) {
  return <div className="min-w-0"><div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-sky-50">{team?.logo_url ? <Image unoptimized width={128} height={128} src={team.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="font-black text-sky-700">{team?.name?.slice(0, 1) || "T"}</span>}</div><p className="mt-2 truncate font-bold text-slate-900 dark:text-slate-50">{team?.name || "Team"}</p></div>;
}
