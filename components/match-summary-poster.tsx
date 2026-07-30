"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { toJpeg } from "html-to-image";
import type { InningsScorecard } from "@/types/scorecard";
import { downloadPosterDataUrl, posterPixelRatio, posterQualityLabel, type PosterQuality } from "@/lib/poster-export";

type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
type PosterInnings = { batting_team_id: string; total_runs: number; total_wickets: number; balls_bowled: number; summary: InningsScorecard };
type PlayerOfMatch = { name: string; summary: string; runs?: number; balls?: number; wickets?: number; bowlingRuns?: number; fours?: number; sixes?: number; notOut?: boolean; photo_url?: string | null };
type Tournament = { name: string; logo_url: string | null };

export function MatchSummaryPoster({ teams, innings, result, playerOfMatch, tournament, matchNumber, tossWinnerTeamId, winnerTeamId }: { teams: Team[]; innings: PosterInnings[]; result: string; playerOfMatch?: PlayerOfMatch | null; tournament?: Tournament | null; matchNumber?: number | null; tossWinnerTeamId?: string | null; winnerTeamId?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<PosterQuality | null>(null);
  const team = (id: string) => teams.find((item) => item.id === id);
  const winningTeam = teams.find((item) => item.id === winnerTeamId) || teams.find((item) => result.toLowerCase().includes(item.name.toLowerCase()));
  const runs = playerOfMatch?.runs ?? Number(playerOfMatch?.summary.match(/(\d+)\s+runs?/i)?.[1] || 0);
  const ballsFaced = playerOfMatch?.balls ?? 0;
  const wickets = playerOfMatch?.wickets ?? Number(playerOfMatch?.summary.match(/(\d+)\s+wickets?/i)?.[1] || 0);
  const bowlingRuns = playerOfMatch?.bowlingRuns ?? 0;
  const fours = playerOfMatch?.fours ?? 0;
  const sixes = playerOfMatch?.sixes ?? 0;

  const download = async (quality: PosterQuality) => {
    if (!ref.current) return;
    setDownloading(quality);
    try {
      const options = { cacheBust: true, pixelRatio: posterPixelRatio(ref.current, quality), backgroundColor: "#07152b" };
      const dataUrl = await toJpeg(ref.current, { ...options, quality: 0.99 });
      await downloadPosterDataUrl(dataUrl, `crickpulse-${quality}-match-summary.jpg`);
    } finally { setDownloading(null); }
  };

  return <section className="space-y-4">
    <div ref={ref} className="relative aspect-[12/11] w-full overflow-hidden rounded-2xl bg-[#050b26] text-white shadow-2xl" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-15%,#2458bd_0%,transparent_46%),linear-gradient(150deg,#050b26_0%,#09265e_54%,#050617_100%)]" />
      <div className="absolute -left-20 top-12 h-3 w-[34rem] -rotate-12 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent blur-sm" />
      <div className="absolute -right-24 bottom-28 h-3 w-[34rem] -rotate-12 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent blur-sm" />
      <div className="absolute inset-4 rounded-[1.4rem] border border-white/20" />
      <div className="absolute left-4 top-4 h-24 w-24 rounded-br-[4rem] border-b border-r border-amber-200/45" />
      <div className="absolute bottom-4 right-4 h-24 w-24 rounded-tl-[4rem] border-l border-t border-cyan-200/40" />
      <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-r from-[#e7b84d] via-[#fff2a8] to-[#e7b84d]" />
      <div className="relative flex h-[calc(100%-16px)] min-h-0 flex-col p-7">
        <div className="relative border-b border-white/15 pb-4"><div className="flex items-center justify-between"><div className="min-w-0 flex-1 pr-4"><p className="text-lg font-black tracking-[0.12em] text-amber-200 drop-shadow">{tournament?.name || "CRICKET TOURNAMENT"}</p><Image unoptimized width={128} height={128} src="/brand/crickpulse-logo.png" alt="Crickpulse" className="mt-1 h-10 w-44 rounded-md border border-white bg-white p-1 object-contain object-left shadow-[0_2px_8px_rgba(34,211,238,0.45)]" /></div><p className="mt-1 rounded-sm border-y-2 border-amber-300 bg-[#0a1f53] px-5 py-2 text-xs font-black tracking-[0.16em] shadow-lg">MATCH SUMMARY</p></div><p className="absolute left-1/2 top-7 -translate-x-1/2 rounded-full border border-amber-200/80 bg-amber-100/10 px-3 py-1 text-xs font-black tracking-[0.2em] text-amber-100 shadow-[0_0_12px_rgba(231,184,77,0.2)]">MATCH {matchNumber ?? "—"}</p></div>
        <div className="mt-4 shrink-0 space-y-3">
          {innings.map((item, index) => {
            const currentTeam = team(item.batting_team_id);
            const color = currentTeam?.primary_color || (index ? "#facc15" : "#0ea5e9");
            return <div key={`${item.batting_team_id}-${index}`} className="overflow-hidden rounded-xl border border-white/15 bg-[#06122d]/90 shadow-[0_12px_22px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-3 border-l-4 px-4 py-2.5" style={{ borderColor: color, background: `linear-gradient(90deg, ${color}d9, ${color}6b)` }}>
                {currentTeam?.logo_url ? <Image unoptimized width={128} height={128} src={currentTeam.logo_url} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-white/80 shadow-md" /> : <div className="h-10 w-10 rounded-full bg-white/20" />}
                <div className="min-w-0"><div className="flex items-center gap-2.5"><p className="truncate text-lg font-black tracking-wide">{currentTeam?.name || "TEAM"}</p>{currentTeam?.id === tossWinnerTeamId && tournament?.logo_url && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-amber-100 bg-white p-0.5 shadow-[0_0_0_2px_rgba(231,184,77,0.45)]"><Image unoptimized width={128} height={128} src={tournament.logo_url} alt={`${tournament.name} logo`} className="h-full w-full rounded-full object-cover" /></span>}</div><p className="text-xs font-semibold opacity-85">{item.summary.overs} overs</p></div>
                <div className="ml-auto border-l border-white/30 pl-4 text-right"><p className="text-[0.6rem] font-bold tracking-[0.14em] text-white/70">SCORE</p><p className="text-3xl font-black leading-none">{item.total_runs}/{item.total_wickets}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-x-5 p-3 text-slate-100">
                <div><p className="mb-1 text-[0.72rem] font-black tracking-[0.15em] text-amber-200">TOP BATTERS</p>{[...item.summary.batting].sort((a, b) => b.runs - a.runs || Number(b.strikeRate) - Number(a.strikeRate)).slice(0, 3).map((batter, batterIndex) => <div key={`${item.batting_team_id}-${index}-batter-${batter.playerId}-${batterIndex}`} className="flex justify-between border-b border-white/10 py-1.5 text-[0.88rem] font-semibold"><span className="truncate pr-2">{batter.name}{batter.dismissal === "not out" && <sup className="ml-1 text-sm text-amber-300">★</sup>}</span><b className="shrink-0 font-black text-amber-100">{batter.runs} ({batter.balls})</b></div>)}</div>
                <div><p className="mb-1 text-[0.72rem] font-black tracking-[0.15em] text-amber-200">TOP BOWLERS</p>{[...item.summary.bowling].sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy) || a.runs - b.runs).slice(0, 3).map((bowler, bowlerIndex) => <div key={`${item.batting_team_id}-${index}-bowler-${bowler.playerId}-${bowlerIndex}`} className="flex justify-between border-b border-white/10 py-1.5 text-[0.88rem] font-semibold"><span className="truncate pr-2">{bowler.name}</span><b className="shrink-0 font-black text-cyan-100">{bowler.wickets}-{bowler.runs}</b></div>)}</div>
              </div>
            </div>;
          })}
        </div>
        {playerOfMatch && <div className="mt-3 h-52 shrink-0">
          <div className="h-full overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-[#0a1e4a] via-[#0b4c9f] to-[#071735] shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
            <div className="grid h-full grid-cols-[0.8fr_1.2fr] items-stretch">
              <div className="flex min-h-0 items-center justify-center bg-[radial-gradient(circle_at_center,#1c62ba_0%,#0a1f4a_58%,#050b26_100%)] p-4">
                <div className="relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white bg-white/10 shadow-2xl shadow-black/40 backdrop-blur">
                  {playerOfMatch.photo_url ? <Image unoptimized width={128} height={128} src={playerOfMatch.photo_url} alt={playerOfMatch.name} className="h-full w-full object-cover object-top" /> : <div className="flex h-full w-full items-center justify-center bg-white/10 text-4xl font-black text-white/50">POM</div>}
                </div>
              </div>
              <div className="flex flex-col justify-center p-4">
                <p className="mb-1.5 text-[0.68rem] font-black tracking-[0.18em] text-amber-300">PLAYER OF THE MATCH</p>
                <p className="inline-flex items-center gap-2 self-start rounded-md border-l-4 border-amber-300 bg-white/10 px-3 py-1.5 text-xl font-black uppercase tracking-wide leading-tight text-white shadow-sm">{playerOfMatch.name}{playerOfMatch.notOut && <sup title="Not out" aria-label="Not out" className="text-xl leading-none text-amber-300 drop-shadow">★</sup>}</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-cyan-200/90 bg-gradient-to-b from-cyan-300/25 to-cyan-500/10 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_14px_rgba(34,211,238,0.12)]"><p className="text-2xl font-black leading-none tracking-tight text-cyan-100 drop-shadow">{runs}/{ballsFaced}</p><p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-white">Runs / Balls</p></div>
                  <div className="rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-300/25 to-amber-500/10 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_14px_rgba(251,191,36,0.12)]"><p className="text-2xl font-black leading-none tracking-tight text-amber-100 drop-shadow">{wickets}/{bowlingRuns}</p><p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-white">Wickets / Runs</p></div>
                  <div className="rounded-xl border border-sky-200/90 bg-gradient-to-b from-sky-300/25 to-blue-500/10 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_14px_rgba(56,189,248,0.12)]"><p className="text-2xl font-black leading-none tracking-tight text-sky-100 drop-shadow">{fours}</p><p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white">Fours</p></div>
                  <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-b from-emerald-300/25 to-emerald-500/10 px-1.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_14px_rgba(52,211,153,0.12)]"><p className="text-2xl font-black leading-none tracking-tight text-emerald-100 drop-shadow">{sixes}</p><p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white">Sixes</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>}
        <div className="mt-auto shrink-0 pt-3"><div className="overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-r from-[#c88e1a] via-[#f7d56b] to-[#c88e1a] px-5 py-3 text-[#06122d] shadow-lg"><div className="flex items-center justify-center gap-3">{winningTeam?.logo_url && <Image unoptimized width={128} height={128} src={winningTeam.logo_url} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-white shadow-md" />}<p className="text-center text-xl font-black uppercase tracking-wide">{result}</p></div></div></div>
      </div>
    </div>
    <div className="flex flex-wrap gap-3">{(["4k"] as PosterQuality[]).map((quality) => <button key={quality} onClick={() => void download(quality)} disabled={!!downloading} className="control bg-primary text-primary-foreground"><Download className="w-4 h-4 mr-1" />{downloading === quality ? `Creating ${posterQualityLabel(quality)}...` : `Download ${posterQualityLabel(quality)} JPG`}</button>)}</div>
  </section>;
}
