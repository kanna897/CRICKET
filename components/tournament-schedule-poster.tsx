"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, MapPin } from "lucide-react";
import { toJpeg } from "html-to-image";
import { downloadPosterDataUrl, inlinePosterImages, posterPixelRatio } from "@/lib/poster-export";

type PosterTournament = { id: string; name: string; logo_url: string | null; venue: string | null };
type PosterTeam = { id: string; name: string; logo_url: string | null };
type PosterMatch = {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  match_date: string | null;
  match_time: string | null;
  ground: string | null;
  match_number: number | null;
  fixture_round: number | null;
};

const BASE_POSTER_HEIGHT = 1350;
const POSTER_CHROME_HEIGHT = 500;
const MATCH_ROW_HEIGHT = 156;
const MATCH_ROW_GAP = 16;

export function TournamentSchedulePoster({ tournaments, teams, matches }: { tournaments: PosterTournament[]; teams: PosterTeam[]; matches: PosterMatch[] }) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [tournamentId, setTournamentId] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const tournament = tournaments.find((item) => item.id === tournamentId);
  const fixtures = useMemo(() => matches
    .filter((match) => match.tournament_id === tournamentId)
    .sort((left, right) => `${left.match_date || "9999"} ${left.match_time || "99"} ${left.match_number || 9999}`.localeCompare(`${right.match_date || "9999"} ${right.match_time || "99"} ${right.match_number || 9999}`)), [matches, tournamentId]);
  const availableDates = useMemo(() => [...new Set(fixtures.map((match) => match.match_date).filter((date): date is string => Boolean(date)))], [fixtures]);
  const datedFixtures = useMemo(() => fixtures.filter((match) => match.match_date === matchDate), [fixtures, matchDate]);
  const dayNumber = Math.max(1, availableDates.indexOf(matchDate) + 1);
  const matchStackHeight = datedFixtures.length * MATCH_ROW_HEIGHT + Math.max(0, datedFixtures.length - 1) * MATCH_ROW_GAP;
  const posterHeight = Math.max(BASE_POSTER_HEIGHT, POSTER_CHROME_HEIGHT + matchStackHeight);
  const team = (id: string) => teams.find((item) => item.id === id);

  const selectTournament = (id: string) => {
    setTournamentId(id);
    const firstDate = matches
      .filter((match) => match.tournament_id === id && match.match_date)
      .sort((left, right) => `${left.match_date} ${left.match_time || "99"}`.localeCompare(`${right.match_date} ${right.match_time || "99"}`))[0]?.match_date || "";
    setMatchDate(firstDate);
  };
  const selectMatchDate = (date: string) => setMatchDate(date);
  const download = async () => {
    if (!posterRef.current || !tournament || !datedFixtures.length || downloading) return;
    setDownloading(true);
    let restoreImages: (() => void) | undefined;
    try {
      await waitForImages(posterRef.current);
      restoreImages = await inlinePosterImages(posterRef.current);
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true,
        pixelRatio: posterPixelRatio(posterRef.current, "4k"),
        quality: .97,
        width: 1080,
        height: posterHeight,
        backgroundColor: "#050d23",
        skipFonts: true,
        style: { transform: "none", transformOrigin: "top left", margin: "0" },
      });
      const slug = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tournament";
      await downloadPosterDataUrl(dataUrl, `${slug}-day-${String(dayNumber).padStart(2, "0")}-${matchDate}-schedule-4k.jpg`);
    } finally {
      restoreImages?.();
      setDownloading(false);
    }
  };

  return <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-lg">
    <header className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-primary">CrickPulse poster studio</p><h2 className="mt-1 text-xl font-black text-foreground">Date-wise tournament schedule</h2><p className="mt-1 text-sm text-muted-foreground">Choose a tournament and match date to download that day&apos;s fixtures as a 4K JPG poster.</p></div>
      <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl"><label className="space-y-2 text-sm font-bold">Tournament<select className="input" value={tournamentId} onChange={(event) => selectTournament(event.target.value)}><option value="">Select tournament</option>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-2 text-sm font-bold">Match date<select className="input" value={matchDate} onChange={(event) => selectMatchDate(event.target.value)} disabled={!tournamentId || !availableDates.length}><option value="">Select match date</option>{availableDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label></div>
    </header>
    {!tournamentId ? <div className="grid min-h-52 place-items-center p-8 text-center text-muted-foreground"><div><CalendarDays className="mx-auto h-10 w-10 text-primary"/><p className="mt-3 font-bold">Select a tournament to create its schedule poster.</p></div></div> : !fixtures.length ? <div className="p-10 text-center text-sm font-bold text-muted-foreground">No matches are scheduled for this tournament yet.</div> : !availableDates.length ? <div className="p-10 text-center text-sm font-bold text-muted-foreground">These matches do not have dates yet. Add match dates before creating a day poster.</div> : !matchDate ? <div className="p-10 text-center text-sm font-bold text-muted-foreground">Select a match date to preview that day&apos;s schedule.</div> : <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-muted-foreground">Day {String(dayNumber).padStart(2, "0")} · {formatDate(matchDate)} · {datedFixtures.length} matches · All matches in one poster</p><button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-[#70e453] to-[#20c997] px-5 text-sm font-black text-[#041129] shadow-lg disabled:opacity-50"><Download className="mr-2 h-4 w-4"/>{downloading ? "Creating 4K poster…" : "Download This Day · 4K JPG"}</button></div>
      <div className="schedule-poster-preview overflow-x-auto rounded-xl bg-[radial-gradient(circle_at_center,rgba(37,99,235,.18),transparent_60%)] p-4">
        <div ref={posterRef} className="schedule-poster relative w-[1080px] shrink-0 overflow-hidden bg-[#050d23] px-[58px] py-[54px] text-white" style={{ height: posterHeight, fontFamily: "Arial, Helvetica, sans-serif", transform: "scale(.5)", transformOrigin: "top left", marginRight: "-540px", marginBottom: posterHeight / -2 }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_5%,rgba(31,104,255,.58),transparent_33%),radial-gradient(circle_at_10%_95%,rgba(112,228,83,.24),transparent_35%),linear-gradient(145deg,#071a43_0%,#050d23_47%,#09285b_100%)]"/>
          <div className="absolute -right-40 top-44 h-[520px] w-[520px] rotate-45 border-[70px] border-white/[.035]"/><div className="absolute -left-44 bottom-28 h-[480px] w-[480px] rotate-12 border-[55px] border-[#70e453]/[.06]"/>
          <div className="relative z-10 flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-white/15 pb-5"><div className="flex items-center gap-5">{tournament?.logo_url ? <Image unoptimized width={104} height={104} src={tournament.logo_url} alt="" className="h-[92px] w-[92px] rounded-2xl border-2 border-white/70 bg-white object-contain p-2"/> : <span className="grid h-[92px] w-[92px] place-items-center rounded-2xl border border-white/25 bg-white/10 text-3xl font-black">CP</span>}<div><p className="text-[15px] font-black uppercase tracking-[.32em] text-[#70e453]">Official fixtures</p><h2 className="mt-2 max-w-[600px] text-[43px] font-black uppercase leading-[.96]">{tournament?.name}</h2></div></div><Image unoptimized width={220} height={64} src="/brand/crickpulse-logo.png" alt="CrickPulse" className="h-[62px] w-[220px] rounded-xl bg-white object-contain px-4 py-2"/></header>
            <div className="py-5 text-center"><p className="text-[17px] font-black uppercase tracking-[.45em] text-sky-300">{formatDate(matchDate)}</p><h1 className="mt-2 text-[54px] font-black uppercase tracking-tight">Match Day {String(dayNumber).padStart(2, "0")} Schedule</h1><div className="mx-auto mt-3 h-1.5 w-32 rounded-full bg-gradient-to-r from-[#70e453] to-cyan-400"/></div>
            <div className="flex-1 space-y-4">{datedFixtures.map((match) => <FixtureRow key={match.id} match={match} left={team(match.team_a_id)} right={team(match.team_b_id)}/>)}</div>
            <footer className="mt-7 flex items-center justify-between border-t border-white/15 pt-5 text-[13px] font-bold uppercase tracking-[.14em] text-slate-300"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#39dc85]"/>{tournament?.venue || datedFixtures[0]?.ground || "Venue to be announced"}</span><span className="flex items-center gap-3 text-[15px] font-black tracking-[.2em] text-[#56e49a]"><Image unoptimized width={180} height={48} src="/brand/crickpulse-logo.png" alt="CrickPulse" className="h-[44px] w-[180px] rounded-lg bg-white object-contain px-3 py-1.5"/><b>· THE RHYTHM OF THE GAME</b></span></footer>
          </div>
        </div>
      </div>
    </div>}
  </section>;
}

function FixtureRow({ match, left, right }: { match: PosterMatch; left?: PosterTeam; right?: PosterTeam }) {
  return <article className="relative overflow-hidden rounded-[18px] border border-white/15 bg-white/[.07] shadow-[0_14px_35px_rgba(0,0,0,.24)]"><div className="grid h-[118px] grid-cols-[1fr_92px_1fr] items-center bg-gradient-to-r from-white via-slate-100 to-white px-5 text-slate-950"><PosterTeamView team={left}/><span className="mx-auto grid h-[64px] w-[64px] place-items-center rounded-full bg-gradient-to-br from-[#70e453] to-[#20c997] text-[20px] font-black shadow-[0_0_0_8px_rgba(5,13,35,.08)]">VS</span><PosterTeamView team={right} reverse/></div><div className="flex h-[38px] items-center justify-center gap-4 bg-gradient-to-r from-[#0c4ca3] via-[#126ee3] to-[#0c4ca3] px-5 text-[15px] font-black uppercase tracking-wide"><span>{match.match_number ? `Match ${match.match_number}` : match.fixture_round ? `Round ${match.fixture_round}` : "Fixture"}</span><span className="text-[#70e453]">•</span><span>{formatDate(match.match_date)}</span><span className="text-[#70e453]">•</span><span>{formatTime(match.match_time)}</span>{match.ground && <><span className="text-[#70e453]">•</span><span className="max-w-[250px] truncate">{match.ground}</span></>}</div></article>;
}

function PosterTeamView({ team, reverse = false }: { team?: PosterTeam; reverse?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-4 ${reverse ? "flex-row-reverse text-right" : ""}`}>{team?.logo_url ? <Image unoptimized width={78} height={78} src={team.logo_url} alt="" className="h-[76px] w-[76px] shrink-0 rounded-2xl bg-white object-contain p-2 shadow-md"/> : <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl bg-slate-200 text-2xl font-black">{team?.name?.slice(0, 2).toUpperCase() || "TM"}</span>}<strong className="min-w-0 flex-1 text-[25px] font-black uppercase leading-[1.05]">{team?.name || "Team TBC"}</strong></div>;
}

function formatDate(value: string | null) { if (!value) return "Date TBC"; const [year, month, day] = value.split("-").map(Number); return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day))); }
function formatTime(value: string | null) { if (!value) return "Time TBC"; const [hours, minutes] = value.split(":").map(Number); const suffix = hours >= 12 ? "PM" : "AM"; return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, "0")} ${suffix}`; }
async function waitForImages(element: HTMLElement) { await Promise.all(Array.from(element.querySelectorAll("img")).map(async (image) => { if (!image.complete) await new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); }); try { await image.decode(); } catch { /* Initials remain visible when an image cannot be decoded. */ } })); }
