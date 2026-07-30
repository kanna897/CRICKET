"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Sparkles, Trophy } from "lucide-react";
import { toJpeg } from "html-to-image";
import type { AuctionPlayer, Team } from "@/features/auction/types";
import { money } from "@/features/auction/utils";
import { downloadPosterDataUrl, posterPixelRatio } from "@/lib/poster-export";

type Props = {
  tournamentName: string;
  players: AuctionPlayer[];
  teams: Team[];
  autoDownloadToken?: number;
  onDownloadComplete?: () => void;
};

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tournament";
}

export function AuctionTopPicksPoster({
  tournamentName,
  players,
  teams,
  autoDownloadToken = 0,
  onDownloadComplete,
}: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const topPicks = [...players]
    .filter((player) => player.status === "sold")
    .sort((a, b) => Number(b.winning_bid || 0) - Number(a.winning_bid || 0))
    .slice(0, 5);
  const hero = topPicks[0];
  const runners = topPicks.slice(1);
  const team = (teamId: string | null) => teams.find((item) => item.id === teamId);

  async function download4K() {
    if (!posterRef.current || downloading || !hero) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true,
        pixelRatio: posterPixelRatio(posterRef.current, "4k"),
        quality: 0.99,
        backgroundColor: "#040817",
        skipFonts: true,
      });
      await downloadPosterDataUrl(
        dataUrl,
        `${safeFilename(tournamentName)}-top-picks-4k.jpg`,
      );
    } finally {
      setDownloading(false);
      onDownloadComplete?.();
    }
  }

  useEffect(() => {
    if (!autoDownloadToken || !hero) return;
    const timer = window.setTimeout(() => void download4K(), 350);
    return () => window.clearTimeout(timer);
    // A new token deliberately triggers exactly one completed-auction export.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownloadToken]);

  if (!hero) return null;
  const heroTeam = team(hero.winning_team_id);

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300/30 bg-card p-5 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-amber-500">Auction poster</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-black"><Sparkles className="h-5 w-5 text-amber-500" />Top Picks of {tournamentName}</h2>
          <p className="text-sm text-muted-foreground">Automatically ranked by the highest winning bids.</p>
        </div>
        <button type="button" disabled={downloading} onClick={() => void download4K()} className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg disabled:opacity-60">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? "Creating 4K JPG..." : "Download 4K JPG"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-slate-950 p-2">
        <div ref={posterRef} className="relative aspect-video min-w-[880px] overflow-hidden bg-[#040817] text-white" style={{ width: 960, fontFamily: "Arial, sans-serif" }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_36%,rgba(18,153,255,.52),transparent_32%),radial-gradient(circle_at_12%_15%,rgba(91,46,255,.58),transparent_35%),linear-gradient(145deg,#080534_0%,#092a6b_54%,#041326_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(1,8,20,.96)),repeating-linear-gradient(90deg,rgba(255,255,255,.035)_0_2px,transparent_2px_55px)]" />
          <div className="absolute -left-24 top-56 h-24 w-[120%] -rotate-6 bg-cyan-400/10 blur-2xl" />
          <div className="absolute inset-3 border border-white/70" />

          <header className="relative flex h-[21%] items-center justify-between border-b border-white/15 bg-gradient-to-r from-[#110b62]/95 via-[#0b2870]/90 to-[#071d48]/95 px-9">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[.32em] text-cyan-200">CrickPulse Live Auction</p>
              <h1 className="mt-1 truncate text-[38px] font-black uppercase leading-none tracking-tight text-amber-300">{tournamentName}</h1>
            </div>
            <div className="ml-6 flex shrink-0 items-center gap-3 rounded-2xl border border-amber-200/40 bg-black/25 px-5 py-3">
              <Trophy className="h-9 w-9 text-amber-300" />
              <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-sky-200">Official</p><strong className="text-xl uppercase">Top Picks</strong></div>
            </div>
          </header>

          <div className="relative grid h-[70%] grid-cols-[36%_64%] gap-6 px-9 py-5">
            <div className="relative overflow-hidden rounded-[28px] border-2 border-white/80 bg-gradient-to-b from-sky-400/25 to-[#07152d] shadow-2xl">
              <Image unoptimized fill src={hero.player_card_url || hero.photo_url} alt={hero.player_name} className="object-cover object-top" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020711] via-[#020711]/94 to-transparent px-5 pb-4 pt-20">
                <div className="flex items-end gap-3">
                  {heroTeam?.logo_url ? <Image unoptimized width={62} height={62} src={heroTeam.logo_url} alt="" className="h-14 w-14 rounded-full border-2 border-white bg-white object-contain p-1" /> : null}
                  <div className="min-w-0"><p className="truncate text-[26px] font-black uppercase leading-none">{hero.player_name}</p><p className="mt-1 truncate text-xs font-bold uppercase tracking-wide text-sky-200">{heroTeam?.name || "Winning team"}</p></div>
                </div>
                <p className="mt-3 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-200 py-2 text-center text-[25px] font-black text-[#07152d]">{money(Number(hero.winning_bid || 0))} POINTS</p>
              </div>
              <span className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">#1 TOP PICK</span>
            </div>

            <div className="flex flex-col justify-center gap-3">
              <h2 className="mb-1 text-[33px] font-black uppercase tracking-tight drop-shadow-[0_3px_0_rgba(96,18,18,.8)]">Top Picks of {tournamentName}</h2>
              {runners.map((player, index) => {
                const winningTeam = team(player.winning_team_id);
                return <article key={player.id} className="grid min-h-[64px] grid-cols-[1fr_170px_64px] items-center gap-4 rounded-2xl border border-white/25 bg-white/10 px-5 py-2 shadow-lg backdrop-blur-sm">
                  <div className="min-w-0"><p className="truncate text-[22px] font-black uppercase leading-tight">{index + 2}. {player.player_name}</p><p className="truncate text-[10px] font-bold uppercase tracking-[.13em] text-cyan-200">{winningTeam?.name || "Winning team"}</p></div>
                  <strong className="text-right text-[21px] font-black text-amber-300">{money(Number(player.winning_bid || 0))} PTS</strong>
                  {winningTeam?.logo_url ? <Image unoptimized width={62} height={62} src={winningTeam.logo_url} alt="" className="h-14 w-14 rounded-full border-2 border-white bg-white object-contain p-1" /> : <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-slate-800 text-lg font-black">{winningTeam?.name?.slice(0, 2) || "CP"}</span>}
                </article>;
              })}
              {Array.from({ length: Math.max(0, 4 - runners.length) }).map((_, index) => <div key={`empty-${index}`} className="grid min-h-[64px] place-items-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-xs font-bold uppercase tracking-[.2em] text-white/35">Awaiting sold player</div>)}
            </div>
          </div>

          <footer className="relative flex h-[9%] items-center justify-between bg-black/45 px-9 text-[11px] font-bold uppercase tracking-[.2em] text-white/75">
            <span>Highest winning bids · Official auction results</span>
            <span className="text-amber-200">CrickPulse · The Rhythm of the Game</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
