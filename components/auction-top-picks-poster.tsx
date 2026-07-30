"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, Loader2, Sparkles, Trophy } from "lucide-react";
import { toJpeg } from "html-to-image";
import type { AuctionPlayer, Team } from "@/features/auction/types";
import { money } from "@/features/auction/utils";
import { downloadPosterDataUrl } from "@/lib/poster-export";

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

function exportSafeUrl(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.hostname === "res.cloudinary.com"
      ? `/api/poster-image?url=${encodeURIComponent(parsed.toString())}`
      : url;
  } catch {
    return url;
  }
}

function PlayerPortrait({ player, className = "" }: { player: AuctionPlayer; className?: string }) {
  const source = exportSafeUrl(player.player_card_url || player.photo_url);
  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_center,#1c62ba_0%,#0a1f4a_58%,#050b26_100%)] ${className}`}>
      {player.player_card_url ? (
        // Uploaded auction cards are square. This fixed crop isolates the portrait panel
        // used by the CricPulse card template instead of showing the full card artwork.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={player.player_name} crossOrigin="anonymous" className="absolute left-[-8%] top-[-72%] h-auto w-[230%] max-w-none" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={player.player_name} crossOrigin="anonymous" className="h-full w-full object-cover object-top" />
      )}
    </div>
  );
}

async function waitForPosterImages(node: HTMLElement) {
  await document.fonts.ready;
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      window.setTimeout(done, 8000);
    });
  }));
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
  const [downloadError, setDownloadError] = useState("");
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
    setDownloadError("");
    try {
      await waitForPosterImages(posterRef.current);
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: false,
        width: 960,
        height: 540,
        canvasWidth: 3840,
        canvasHeight: 2160,
        pixelRatio: 1,
        quality: 0.98,
        backgroundColor: "#07152b",
        skipFonts: true,
      });
      await downloadPosterDataUrl(dataUrl, `${safeFilename(tournamentName)}-top-picks-4k.jpg`);
      onDownloadComplete?.();
    } catch (reason) {
      console.error("Top Picks poster export failed", reason);
      setDownloadError("Poster download failed. Reload this page once and try Download 4K JPG again.");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (!autoDownloadToken || !hero) return;
    const timer = window.setTimeout(() => void download4K(), 600);
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
          <p className="text-sm text-muted-foreground">Top five players ranked by winning bid with profile-photo crops.</p>
        </div>
        <button type="button" disabled={downloading} onClick={() => void download4K()} className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg disabled:opacity-60">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? "Creating 4K JPG..." : "Download 4K JPG"}
        </button>
      </div>
      {downloadError && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{downloadError}</p>}

      <div className="overflow-x-auto rounded-xl bg-slate-950 p-2">
        <div ref={posterRef} className="relative aspect-video min-w-[880px] overflow-hidden bg-[#07152b] text-white" style={{ width: 960, fontFamily: "Arial, sans-serif" }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-15%,#2458bd_0%,transparent_46%),linear-gradient(150deg,#050b26_0%,#09265e_54%,#050617_100%)]" />
          <div className="absolute -left-20 top-12 h-3 w-[34rem] -rotate-12 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent blur-sm" />
          <div className="absolute -right-24 bottom-28 h-3 w-[34rem] -rotate-12 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent blur-sm" />
          <div className="absolute inset-4 rounded-[1.4rem] border border-white/20" />
          <div className="absolute left-4 top-4 h-24 w-24 rounded-br-[4rem] border-b border-r border-amber-200/45" />
          <div className="absolute bottom-4 right-4 h-24 w-24 rounded-tl-[4rem] border-l border-t border-cyan-200/40" />
          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-r from-[#e7b84d] via-[#fff2a8] to-[#e7b84d]" />

          <div className="relative flex h-full flex-col px-7 pb-4 pt-7">
            <header className="flex h-[78px] shrink-0 items-center justify-between border-b border-white/15 pb-3">
              <div className="min-w-0 pr-5">
                <p className="text-[11px] font-black uppercase tracking-[.22em] text-amber-200">{tournamentName}</p>
                <h1 className="mt-1 text-[31px] font-black uppercase leading-none tracking-tight">Top Picks</h1>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-sm border-y-2 border-amber-300 bg-[#0a1f53] px-5 py-2 shadow-lg">
                <Trophy className="h-8 w-8 text-amber-300" />
                <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-amber-200">Live Auction</p><strong className="text-lg uppercase">Official Results</strong></div>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-[37%_63%] gap-5 py-4">
              <div className="relative overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-[#0a1e4a] via-[#0b4c9f] to-[#071735] shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
                <PlayerPortrait player={hero} className="absolute inset-3 bottom-[105px] rounded-[1.6rem] border-4 border-white shadow-2xl" />
                <span className="absolute left-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">#1 TOP PICK</span>
                <div className="absolute inset-x-0 bottom-0 h-[118px] bg-gradient-to-t from-[#020711] via-[#020711]/95 to-transparent px-5 pb-4 pt-7">
                  <div className="flex items-end gap-3">
                    {heroTeam?.logo_url ? <Image unoptimized width={58} height={58} src={exportSafeUrl(heroTeam.logo_url)} alt="" crossOrigin="anonymous" className="h-13 w-13 rounded-full border-2 border-white bg-white object-contain p-1" /> : null}
                    <div className="min-w-0"><p className="truncate text-[24px] font-black uppercase leading-none">{hero.player_name}</p><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-sky-200">{heroTeam?.name || "Winning team"}</p></div>
                  </div>
                  <p className="mt-2 rounded-md bg-gradient-to-r from-[#c88e1a] via-[#f7d56b] to-[#c88e1a] py-1.5 text-center text-[20px] font-black text-[#06122d]">{money(Number(hero.winning_bid || 0))} POINTS</p>
                </div>
              </div>

              <div className="flex min-h-0 flex-col justify-center gap-2.5">
                {runners.map((player, index) => {
                  const winningTeam = team(player.winning_team_id);
                  return <article key={player.id} className="grid min-h-[78px] grid-cols-[68px_1fr_140px_50px] items-center gap-3 overflow-hidden rounded-xl border border-white/15 bg-[#06122d]/90 px-3 py-2 shadow-[0_12px_22px_rgba(0,0,0,0.24)]">
                    <PlayerPortrait player={player} className="h-[62px] w-[62px] rounded-xl border-2 border-white" />
                    <div className="min-w-0"><p className="truncate text-[19px] font-black uppercase leading-tight">{index + 2}. {player.player_name}</p><p className="truncate text-[9px] font-bold uppercase tracking-[.13em] text-cyan-200">{winningTeam?.name || "Winning team"}</p></div>
                    <strong className="text-right text-[18px] font-black text-amber-300">{money(Number(player.winning_bid || 0))} PTS</strong>
                    {winningTeam?.logo_url ? <Image unoptimized width={48} height={48} src={exportSafeUrl(winningTeam.logo_url)} alt="" crossOrigin="anonymous" className="h-11 w-11 rounded-full border-2 border-white bg-white object-contain p-1" /> : <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-slate-800 text-sm font-black">{winningTeam?.name?.slice(0, 2) || "CP"}</span>}
                  </article>;
                })}
                {Array.from({ length: Math.max(0, 4 - runners.length) }).map((_, index) => <div key={`empty-${index}`} className="grid min-h-[78px] place-items-center rounded-xl border border-dashed border-white/20 bg-white/5 text-xs font-bold uppercase tracking-[.2em] text-white/35">Awaiting sold player</div>)}
              </div>
            </div>

            <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/15 pt-2 text-[9px] font-bold uppercase tracking-[.16em] text-sky-100/70">
              <span>Highest winning bids · Official auction results</span>
              <span className="text-amber-200">CrickPulse · The Rhythm of the Game</span>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}
