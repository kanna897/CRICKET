"use client";

import { useRef, useState } from "react";
import { Download, Trophy } from "lucide-react";
import { toJpeg } from "html-to-image";
import type { StandingRow } from "@/lib/tournament-standings";
import { downloadPosterDataUrl, posterPixelRatio, posterQualityLabel, type PosterQuality } from "@/lib/poster-export";

type Team = { id: string; name: string; logo_url?: string | null };

export function PointsTablePoster({ tournamentName, tournamentLogo, rows, teams }: { tournamentName: string; tournamentLogo?: string | null; rows: StandingRow[]; teams: Team[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<PosterQuality | null>(null);
  const team = (id: string) => teams.find((item) => item.id === id);

  const download = async (quality: PosterQuality) => {
    if (!ref.current || downloading || !rows.length) return;
    setDownloading(quality);
    try {
      const dataUrl = await toJpeg(ref.current, { cacheBust: true, pixelRatio: posterPixelRatio(ref.current, quality), quality: 0.99, backgroundColor: "#050b26", skipFonts: true });
      await downloadPosterDataUrl(dataUrl, `${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${quality}-points-table.jpg`);
    } finally { setDownloading(null); }
  };

  if (!rows.length) return null;
  return <section className="space-y-3">
    <div className="flex flex-wrap justify-end gap-2">{(["4k"] as PosterQuality[]).map((quality) => <button key={quality} type="button" onClick={() => void download(quality)} disabled={!!downloading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"><Download className="h-4 w-4" />{downloading === quality ? `Creating ${posterQualityLabel(quality)}...` : `Download ${posterQualityLabel(quality)} JPG`}</button>)}</div>
    <div ref={ref} className="points-poster-table overflow-hidden rounded-2xl border border-amber-300/60 shadow-2xl" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="points-poster-heading"><div><p className="flex items-center gap-2">{tournamentLogo ? <img src={tournamentLogo} alt={`${tournamentName} logo`} className="!h-8 !w-8 shrink-0 !rounded-full !border-amber-200/60 !bg-white !p-0.5" /> : null}<span>{tournamentName}</span></p><strong><Trophy className="h-6 w-6 text-amber-300" /> Points Table</strong></div><img src="/brand/crickpulse-logo.png" alt="CrickPulse" /></div>
      <div className="overflow-x-auto"><table className="points-scoreboard-table w-full min-w-[720px] text-left text-sm"><thead><tr><th className="px-5 py-4">#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NRR</th><th className="pr-5 text-right">Pts</th></tr></thead><tbody>{rows.map((row, index) => { const current = team(row.team_id); const qualified = rows.length >= 4 && index < 4; return <tr key={row.team_id}><td className="px-5 py-4 text-lg font-black text-amber-300">{index + 1}</td><td><span className="flex items-center gap-3 font-black">{current?.logo_url ? <img src={current.logo_url} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-white/80" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs">{current?.name?.slice(0, 2) || "T"}</span>}<span>{current?.name || "Team"}{qualified && <small className="ml-2 rounded-full bg-emerald-400/20 px-2 py-1 text-[.58rem] text-emerald-200">Q</small>}</span></span></td><td>{row.played}</td><td className="font-bold text-emerald-300">{row.won}</td><td className="font-bold text-rose-300">{row.lost}</td><td>{row.tied}</td><td className={`font-black ${row.nrr >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td><td className="pr-5 text-right text-xl font-black text-amber-300">{row.points}</td></tr>; })}</tbody></table></div>
      <footer className="flex items-center justify-between gap-4 border-t border-white/15 px-5 py-3 text-[.65rem] font-bold uppercase tracking-[.14em] text-sky-100/70"><span>Official Tournament Standings</span><span className="flex items-center justify-end gap-2"><img src="/brand/crickpulse-logo.png" alt="CrickPulse" className="h-5 w-20 rounded bg-white object-contain px-1" /><span>· The Rhythm of the Game</span></span></footer>
    </div>
  </section>;
}
