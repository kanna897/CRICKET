"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, Gavel, Loader2, Sparkles } from "lucide-react";
import { toJpeg } from "html-to-image";
import type { AuctionPlayer, Team } from "@/features/auction/types";
import { money } from "@/features/auction/utils";
import { downloadPosterDataUrl } from "@/lib/poster-export";
import { cloudinaryLogoUrl } from "@/lib/media";

type Props = {
  tournamentName: string;
  tournamentLogo?: string | null;
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
    return parsed.origin === window.location.origin
      ? parsed.pathname + parsed.search
      : `/api/poster-image?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}

function exportSafeLogoUrl(url: string) {
  return exportSafeUrl(cloudinaryLogoUrl(url));
}

function PlayerPortrait({ player, className = "" }: { player: AuctionPlayer; className?: string }) {
  const source = exportSafeUrl(player.player_card_url || player.photo_url);
  return (
    <div
      data-poster-image-url={source}
      className={`relative overflow-hidden bg-[radial-gradient(circle_at_center,#1c62ba_0%,#0a1f4a_58%,#050b26_100%)] bg-no-repeat ${className}`}
      style={player.player_card_url ? {
        backgroundImage: `url(${JSON.stringify(source)})`,
        backgroundPosition: "11% 45%",
        backgroundSize: "308% auto",
      } : undefined}
      role="img"
      aria-label={`${player.player_name} profile photo`}
    >
      {player.player_card_url ? (
        <span className="sr-only">{player.player_name}</span>
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
  const backgroundUrls = Array.from(node.querySelectorAll<HTMLElement>("[data-poster-image-url]"))
    .map((element) => element.dataset.posterImageUrl)
    .filter((url): url is string => Boolean(url));
  await Promise.all([...images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      window.setTimeout(done, 8000);
    });
  }), ...backgroundUrls.map((url) => new Promise<void>((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
    window.setTimeout(resolve, 8000);
  }))]);
}

async function loadCanvasImage(url: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load poster image: ${url}`));
    image.src = url;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function AuctionTopPicksPoster({
  tournamentName,
  tournamentLogo,
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
      let dataUrl: string;
      try {
        dataUrl = await toJpeg(posterRef.current, {
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
      } catch (domCaptureError) {
        console.warn("DOM poster capture failed; using native canvas fallback.", domCaptureError);
        dataUrl = await renderCanvasFallback();
      }
      await downloadPosterDataUrl(dataUrl, `${safeFilename(tournamentName)}-top-picks-4k.jpg`);
      onDownloadComplete?.();
    } catch (reason) {
      console.error("Top Picks poster export failed", reason);
      const detail = reason instanceof Error ? reason.message : "Unknown export error";
      setDownloadError(`Poster download failed: ${detail}. Please try once more.`);
    } finally {
      setDownloading(false);
    }
  }

  async function renderCanvasFallback() {
    const canvas = document.createElement("canvas");
    canvas.width = 3840;
    canvas.height = 2160;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("4K canvas is not available.");
    const scale = 4;
    context.scale(scale, scale);

    const background = context.createLinearGradient(0, 0, 960, 540);
    background.addColorStop(0, "#050b26");
    background.addColorStop(0.55, "#09265e");
    background.addColorStop(1, "#050617");
    context.fillStyle = background;
    context.fillRect(0, 0, 960, 540);
    const gold = context.createLinearGradient(0, 0, 960, 0);
    gold.addColorStop(0, "#e7b84d");
    gold.addColorStop(0.5, "#fff2a8");
    gold.addColorStop(1, "#e7b84d");
    context.fillStyle = gold;
    context.fillRect(0, 0, 960, 16);
    context.strokeStyle = "rgba(255,255,255,.25)";
    context.lineWidth = 1;
    roundedRect(context, 16, 16, 928, 508, 22);
    context.stroke();

    const tournamentImage = tournamentLogo ? await loadCanvasImage(exportSafeLogoUrl(tournamentLogo)).catch(() => null) : null;
    if (tournamentImage) {
      context.save();
      context.beginPath();
      context.arc(48, 49, 18, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = "#fff";
      context.fillRect(30, 31, 36, 36);
      context.drawImage(tournamentImage, 32, 33, 32, 32);
      context.restore();
    }
    context.fillStyle = "#ffe99b";
    context.font = "900 11px Arial";
    context.fillText(tournamentName.toUpperCase().slice(0, 60), tournamentImage ? 76 : 34, 49);
    context.fillStyle = "#fff";
    context.font = "900 31px Arial";
    context.fillText("TOP PICKS", 34, 86);

    context.fillStyle = "#0a1f53";
    roundedRect(context, 688, 30, 240, 62, 7);
    context.fill();
    context.strokeStyle = "#facc15";
    context.stroke();
    context.fillStyle = "#facc15";
    context.font = "900 30px Arial";
    context.fillText("⚒", 706, 70);
    context.fillStyle = "#ffe99b";
    context.font = "900 9px Arial";
    context.fillText("LIVE AUCTION", 750, 50);
    context.fillStyle = "#fff";
    context.font = "900 18px Arial";
    context.fillText("OFFICIAL RESULTS", 750, 73);
    context.strokeStyle = "rgba(255,255,255,.18)";
    context.beginPath();
    context.moveTo(34, 106);
    context.lineTo(926, 106);
    context.stroke();

    const drawPortrait = async (player: AuctionPlayer, x: number, y: number, width: number, height: number, radius: number) => {
      const image = await loadCanvasImage(exportSafeUrl(player.player_card_url || player.photo_url));
      context.save();
      roundedRect(context, x, y, width, height, radius);
      context.clip();
      if (player.player_card_url) context.drawImage(image, 85, 294, 348, 515, x, y, width, height);
      else context.drawImage(image, x, y, width, height);
      context.restore();
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      roundedRect(context, x, y, width, height, radius);
      context.stroke();
    };
    const drawLogo = async (url: string | null | undefined, x: number, y: number, size: number) => {
      context.save();
      context.beginPath();
      context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = "#fff";
      context.fillRect(x, y, size, size);
      if (url) {
        const image = await loadCanvasImage(exportSafeLogoUrl(url)).catch(() => null);
        if (image) {
          const ratio = Math.min((size - 4) / image.naturalWidth, (size - 4) / image.naturalHeight);
          const width = image.naturalWidth * ratio;
          const height = image.naturalHeight * ratio;
          context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
        }
      }
      context.restore();
    };

    context.fillStyle = "#071c43";
    roundedRect(context, 34, 122, 334, 354, 17);
    context.fill();
    context.strokeStyle = "#facc15";
    context.stroke();
    await drawPortrait(hero, 125, 168, 182, 270, 24);
    context.fillStyle = "#facc15";
    roundedRect(context, 55, 143, 108, 25, 13);
    context.fill();
    context.fillStyle = "#07152b";
    context.font = "900 12px Arial";
    context.fillText("#1 TOP PICK", 68, 160);
    await drawLogo(heroTeam?.logo_url, 54, 385, 55);
    context.fillStyle = "#fff";
    context.font = "900 22px Arial";
    context.fillText(hero.player_name.toUpperCase().slice(0, 20), 120, 419);
    context.fillStyle = "#bfe8ff";
    context.font = "900 9px Arial";
    context.fillText((heroTeam?.name || "WINNING TEAM").toUpperCase().slice(0, 30), 120, 438);
    context.fillStyle = "#e7b84d";
    roundedRect(context, 55, 448, 292, 28, 6);
    context.fill();
    context.fillStyle = "#07152b";
    context.font = "900 19px Arial";
    context.textAlign = "center";
    context.fillText(`${money(Number(hero.winning_bid || 0))} POINTS`, 201, 469);
    context.textAlign = "left";

    for (let index = 0; index < runners.length; index += 1) {
      const player = runners[index];
      const winningTeam = team(player.winning_team_id);
      const y = 126 + index * 90;
      context.fillStyle = "#06122d";
      roundedRect(context, 390, y, 540, 80, 13);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,.2)";
      context.stroke();
      await drawPortrait(player, 402, y + 9, 62, 62, 10);
      context.fillStyle = "#fff";
      context.font = "900 20px Arial";
      context.fillText(`${index + 2}. ${player.player_name.toUpperCase().slice(0, 24)}`, 480, y + 35);
      context.fillStyle = "#7dd3fc";
      context.font = "900 9px Arial";
      context.fillText((winningTeam?.name || "WINNING TEAM").toUpperCase().slice(0, 32), 480, y + 53);
      context.fillStyle = "#facc15";
      context.font = "900 18px Arial";
      context.textAlign = "right";
      context.fillText(`${money(Number(player.winning_bid || 0))} PTS`, 870, y + 45);
      context.textAlign = "left";
      await drawLogo(winningTeam?.logo_url, 882, y + 14, 52);
    }
    context.fillStyle = "#bfe8ff";
    context.font = "700 9px Arial";
    context.fillText("HIGHEST WINNING BIDS · OFFICIAL AUCTION RESULTS", 34, 516);
    context.fillStyle = "#ffe99b";
    context.textAlign = "right";
    context.fillText("CRICKPULSE · THE RHYTHM OF THE GAME", 926, 516);
    context.textAlign = "left";
    return canvas.toDataURL("image/jpeg", 0.96);
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
          <p className="text-sm text-muted-foreground">Live ranking · updates automatically after every player sale.</p>
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
                <p className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[.22em] text-amber-200">
                  {tournamentLogo ? <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-amber-200 bg-white"><Image unoptimized fill src={exportSafeLogoUrl(tournamentLogo)} alt={`${tournamentName} logo`} crossOrigin="anonymous" className="object-contain p-0.5" /></span> : null}
                  <span className="truncate">{tournamentName}</span>
                </p>
                <h1 className="mt-1 text-[31px] font-black uppercase leading-none tracking-tight">Top Picks</h1>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-sm border-y-2 border-amber-300 bg-[#0a1f53] px-5 py-2 shadow-lg">
                <Gavel className="h-9 w-9 -rotate-12 text-amber-300" />
                <div><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.2em] text-amber-200"><span className="h-2 w-2 rounded-full bg-red-500" />Live Auction</p><strong className="text-lg uppercase">Official Results</strong></div>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-[37%_63%] gap-5 py-4">
              <div className="relative overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-[#0a1e4a] via-[#0b4c9f] to-[#071735] shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
                <PlayerPortrait player={hero} className="absolute left-1/2 top-11 h-[270px] w-[182px] -translate-x-1/2 rounded-[1.6rem] border-4 border-white shadow-2xl" />
                <span className="absolute left-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">#1 TOP PICK</span>
                <div className="absolute inset-x-0 bottom-0 h-[118px] bg-gradient-to-t from-[#020711] via-[#020711]/95 to-transparent px-5 pb-4 pt-7">
                  <div className="flex items-end gap-3">
                    {heroTeam?.logo_url ? <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white"><Image unoptimized fill src={exportSafeLogoUrl(heroTeam.logo_url)} alt="" crossOrigin="anonymous" className="object-contain p-0.5" /></span> : null}
                    <div className="min-w-0"><p className="truncate text-[24px] font-black uppercase leading-none">{hero.player_name}</p><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-sky-200">{heroTeam?.name || "Winning team"}</p></div>
                  </div>
                  <p className="mt-1 flex h-9 items-center justify-center rounded-md bg-gradient-to-r from-[#c88e1a] via-[#f7d56b] to-[#c88e1a] text-center text-[18px] font-black leading-none text-[#06122d]">{money(Number(hero.winning_bid || 0))} POINTS</p>
                </div>
              </div>

              <div className="flex min-h-0 flex-col justify-center gap-2.5">
                {runners.map((player, index) => {
                  const winningTeam = team(player.winning_team_id);
                  return <article key={player.id} className="grid min-h-[78px] grid-cols-[68px_1fr_140px_56px] items-center gap-3 overflow-hidden rounded-xl border border-white/15 bg-[#06122d]/90 px-3 py-2 shadow-[0_12px_22px_rgba(0,0,0,0.24)]">
                    <PlayerPortrait player={player} className="h-[62px] w-[62px] rounded-xl border-2 border-white" />
                    <div className="min-w-0"><p className="truncate text-[19px] font-black uppercase leading-tight">{index + 2}. {player.player_name}</p><p className="truncate text-[9px] font-bold uppercase tracking-[.13em] text-cyan-200">{winningTeam?.name || "Winning team"}</p></div>
                    <strong className="text-right text-[18px] font-black text-amber-300">{money(Number(player.winning_bid || 0))} PTS</strong>
                    {winningTeam?.logo_url ? <span className="relative h-13 w-13 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white"><Image unoptimized fill src={exportSafeLogoUrl(winningTeam.logo_url)} alt="" crossOrigin="anonymous" className="object-contain p-0.5" /></span> : <span className="grid h-13 w-13 place-items-center rounded-full border-2 border-white bg-slate-800 text-sm font-black">{winningTeam?.name?.slice(0, 2) || "CP"}</span>}
                  </article>;
                })}
                {Array.from({ length: Math.max(0, 4 - runners.length) }).map((_, index) => <div key={`empty-${index}`} className="grid min-h-[78px] place-items-center rounded-xl border border-dashed border-white/20 bg-white/5 text-xs font-bold uppercase tracking-[.2em] text-white/35">Awaiting sold player</div>)}
              </div>
            </div>

            <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/15 pt-2 text-[9px] font-bold uppercase tracking-[.16em] text-sky-100/70">
              <span>Highest winning bids · Official auction results</span>
              <span className="flex items-center gap-2 text-amber-200"><Image unoptimized width={94} height={24} src="/brand/crickpulse-logo.png" alt="CrickPulse" className="h-5 w-[84px] rounded bg-white object-contain px-1" />· The Rhythm of the Game</span>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}
