"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Download, Trophy } from "lucide-react";
import { toJpeg } from "html-to-image";
import { downloadPosterDataUrl, posterPixelRatio } from "@/lib/poster-export";
import { loserOf, playoffFormat, shortTeamName, type IplPlayoffMatch } from "@/lib/ipl-playoffs";
import { supabase } from "@/lib/supabase";

type Team = { id: string; name: string; logo_url: string | null };

export function IplPlayoffRoadmap({ tournamentId, tournamentName, tournamentLogo, teams, matches, publicMode = false }: { tournamentId?: string; tournamentName: string; tournamentLogo?: string | null; teams: Team[]; matches: IplPlayoffMatch[]; publicMode?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const q1 = matches.find((match) => match.bracket_round === 1 && match.bracket_slot === 1);
  const eliminator = matches.find((match) => match.bracket_round === 1 && match.bracket_slot === 2);
  const q2 = matches.find((match) => match.bracket_round === 2 && match.bracket_slot === 1);
  const format = playoffFormat(matches);
  const semi1 = matches.find((match) => match.bracket_round === 10 && match.bracket_slot === 1);
  const semi2 = matches.find((match) => match.bracket_round === 10 && match.bracket_slot === 2);
  const final = matches.find((match) => match.bracket_round === (format === "knockout" ? 11 : 3) && match.bracket_slot === 1);
  const team = (id?: string | null) => teams.find((item) => item.id === id);
  const exportPoster = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(ref.current, { cacheBust: true, pixelRatio: posterPixelRatio(ref.current, "4k"), quality: .99, backgroundColor: "#050b26", skipFonts: true });
      await downloadPosterDataUrl(dataUrl, `${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-ipl-playoffs-4k.jpg`);
    } finally { setDownloading(false); }
  };
  useEffect(() => {
    if (!publicMode || !tournamentId) return;
    const channel = supabase.channel(`ipl-public-${tournamentId}`).on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, () => router.refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [publicMode, router, tournamentId]);
  return <section className="space-y-3">
    <div ref={ref} className="relative aspect-[16/10] min-h-[520px] w-full overflow-hidden rounded-3xl bg-[#050b26] text-white shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,#1557a7_0%,transparent_31%),linear-gradient(145deg,#050b26_0%,#09265e_52%,#04101f_100%)]"/>
      <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-r from-[#b77b16] via-[#ffe699] to-[#b77b16]"/>
      <div className="absolute inset-5 rounded-[1.6rem] border border-white/15"/>
      <div className="relative flex h-full flex-col p-7 sm:p-10">
        <header className="flex items-center justify-between border-b border-white/15 pb-4">
          <div className="flex min-w-0 items-center gap-3">{tournamentLogo ? <Image unoptimized src={tournamentLogo} width={128} height={128} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1"/> : <Trophy className="h-12 w-12 text-amber-300"/>}<div className="min-w-0"><p className="truncate text-lg font-black tracking-wide text-amber-200">{tournamentName}</p><h2 className="text-2xl font-black sm:text-4xl">ROAD TO THE FINAL</h2></div></div>
          <div className="rounded-xl border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-center"><Crown className="mx-auto h-7 w-7 text-amber-300"/><span className="text-[.6rem] font-black tracking-widest">{format === "knockout" ? "KNOCKOUT FINALS" : "IPL PLAYOFFS"}</span></div>
        </header>
        {format === "league" ? <div className="grid flex-1 grid-cols-[1fr_.9fr_1fr] items-center gap-3 py-5 sm:gap-8">
          <div className="space-y-8"><MatchNode title="QUALIFIER 1" a={team(q1?.team_a_id)} b={team(q1?.team_b_id)} winner={q1?.winner_id}/><MatchNode title="ELIMINATOR" a={team(eliminator?.team_a_id)} b={team(eliminator?.team_b_id)} winner={eliminator?.winner_id}/></div>
          <div><MatchNode title="QUALIFIER 2" a={team(q2?.team_a_id || loserOf(q1))} b={team(q2?.team_b_id || eliminator?.winner_id)} winner={q2?.winner_id} aFallback="LOSER Q1" bFallback="WINNER ELIMINATOR"/></div>
          <div><MatchNode title="THE FINAL" a={team(final?.team_a_id || q1?.winner_id)} b={team(final?.team_b_id || q2?.winner_id)} winner={final?.winner_id} aFallback="WINNER Q1" bFallback="WINNER Q2" champion/></div>
        </div> : <div className="grid flex-1 grid-cols-[1fr_.8fr_1fr] items-center gap-4 py-7 sm:gap-10"><div className="space-y-8"><MatchNode title="SEMI FINAL 1" a={team(semi1?.team_a_id)} b={team(semi1?.team_b_id)} winner={semi1?.winner_id}/><MatchNode title="SEMI FINAL 2" a={team(semi2?.team_a_id)} b={team(semi2?.team_b_id)} winner={semi2?.winner_id}/></div><div className="text-center text-xs font-black tracking-widest text-cyan-100">SEMI FINAL<br/>WINNERS<br/><span className="text-3xl text-amber-300">→</span></div><div><MatchNode title="THE FINAL" a={team(final?.team_a_id || semi1?.winner_id)} b={team(final?.team_b_id || semi2?.winner_id)} winner={final?.winner_id} aFallback="WINNER SF1" bFallback="WINNER SF2" champion/></div></div>}
        <footer className="flex items-center justify-between border-t border-white/15 pt-3 text-[.65rem] font-black tracking-[.18em] text-cyan-100"><span>{format === "knockout" ? "SEMI FINAL 1 · SEMI FINAL 2 · FINAL" : "1 vs 2 · 3 vs 4 · LOSER Q1 GETS A SECOND CHANCE"}</span><span>{final?.winner_id ? `${shortTeamName(team(final.winner_id)?.name || "CHAMPION")} · CHAMPION` : "CHAMPION ROADMAP"}</span></footer>
      </div>
    </div>
    {!publicMode && <p className="text-xs text-muted-foreground">{format === "knockout" ? "Four teams play two semi finals; both winners automatically advance to the Final." : "Top 4 are seeded from league points, NRR and wins. Results update the next IPL playoff automatically."}</p>}
    <button type="button" onClick={() => void exportPoster()} disabled={downloading} className="control bg-primary text-primary-foreground"><Download className="mr-2 h-4 w-4"/>{downloading ? "Creating 4K poster..." : "Download 4K Playoff Poster"}</button>
  </section>;
}

function MatchNode({ title, a, b, winner, aFallback = "TBD", bFallback = "TBD", champion = false }: { title: string; a?: Team; b?: Team; winner?: string | null; aFallback?: string; bFallback?: string; champion?: boolean }) {
  return <article className={`overflow-hidden rounded-2xl border shadow-xl ${champion ? "border-amber-300 bg-amber-300/10" : "border-cyan-300/35 bg-[#071735]/90"}`}><h3 className="bg-gradient-to-r from-[#168ed0] to-[#3157b7] px-3 py-2 text-center text-xs font-black tracking-widest">{title}</h3><TeamSlot item={a} fallback={aFallback} winner={winner === a?.id}/><div className="mx-3 border-t border-dashed border-white/20"/><TeamSlot item={b} fallback={bFallback} winner={winner === b?.id}/>{champion && <p className="bg-gradient-to-r from-[#b77b16] via-[#ffe699] to-[#b77b16] py-1.5 text-center text-[.62rem] font-black tracking-[.18em] text-[#07152b]">{winner ? "TOURNAMENT CHAMPION" : "ROAD TO CHAMPION"}</p>}</article>;
}
function TeamSlot({ item, fallback, winner }: { item?: Team; fallback: string; winner: boolean }) {
  return <div className={`flex min-h-16 items-center gap-2 px-3 py-2 ${winner ? "bg-emerald-400/20" : ""}`}>{item?.logo_url ? <Image unoptimized src={item.logo_url} width={96} height={96} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-1"/> : <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-black">?</span>}<strong className="min-w-0 flex-1 truncate text-sm">{item ? shortTeamName(item.name) : fallback}</strong>{winner && <Trophy className="h-4 w-4 shrink-0 text-amber-300"/>}</div>;
}
