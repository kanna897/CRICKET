"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- live scoring tables are newer than the generated local Supabase types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Calculator, Download, FileDown, Loader2, Medal, Printer, RefreshCw, Share2, Target, Trophy } from "lucide-react";
import { toPng } from "html-to-image";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { calculateMvpTournamentStats, calculateTournamentPlayerStats, type MvpTournamentStat, type PlayerTournamentStat, type StatisticsBall, type StatisticsInnings, type StatisticsMatch, type StatisticsPlayer, type StatisticsTeam } from "@/lib/tournament-statistics";
type Tournament = {
    id: string;
    name: string;
};
export function TournamentStatisticsDashboard({ admin = false, organizerId, isMasterAdmin = false }: {
    admin?: boolean;
    organizerId?: string;
    isMasterAdmin?: boolean;
}) {
    const t = useTranslations("Statistics");
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState("");
    const [stats, setStats] = useState<PlayerTournamentStat[]>([]);
    const [mvpStats, setMvpStats] = useState<MvpTournamentStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [exporting, setExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const text = "text-foreground";
    const card = "border-border bg-card text-foreground";
    useEffect(() => {
        void (async () => {
            let query = supabase.from("tournaments").select("id,name").order("created_at", { ascending: false });
            if (admin && !isMasterAdmin && organizerId)
                query = query.eq("organizer_id", organizerId);
            const { data, error } = await query;
            const rows = (data || []) as Tournament[];
            setTournaments(rows);
            setSelectedTournament((current) => current || rows[0]?.id || "");
            setMessage(error?.message || "");
            if (!rows.length)
                setLoading(false);
        })();
    }, [admin, isMasterAdmin, organizerId]);
    const load = useCallback(async () => {
        if (!selectedTournament)
            return;
        setLoading(true);
        setMessage("");
        const [teamResult, matchResult] = await Promise.all([
            supabase.from("teams").select("id,name,logo_url").eq("tournament_id", selectedTournament),
            supabase.from("matches").select("id,status,player_of_match_id").eq("tournament_id", selectedTournament),
        ]);
        const teams = (teamResult.data || []) as StatisticsTeam[];
        const matches = (matchResult.data || []) as StatisticsMatch[];
        const matchIds = matches.map((match) => match.id);
        const inningsResult = matchIds.length ? await supabase.from("innings").select("id,match_id,batting_team_id,bowling_team_id").in("match_id", matchIds) : { data: [], error: null };
        const innings = (inningsResult.data || []) as StatisticsInnings[];
        const inningsIds = innings.map((item) => item.id);
        const teamIds = teams.map((team) => team.id);
        const [playerResult, ballResult] = await Promise.all([
            teamIds.length ? supabase.from("players").select("id,name,team_id,photo_url").in("team_id", teamIds) : Promise.resolve({ data: [], error: null }),
            inningsIds.length ? supabase.from("ball_by_ball").select("innings_id,over_number,batsman_id,bowler_id,player_out_id,fielder_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type").in("innings_id", inningsIds) : Promise.resolve({ data: [], error: null }),
        ]);
        const players = (playerResult.data || []) as StatisticsPlayer[];
        const balls = (ballResult.data || []) as StatisticsBall[];
        setStats(calculateTournamentPlayerStats(players, teams, innings, balls));
        setMvpStats(calculateMvpTournamentStats(players, teams, innings, balls, matches));
        setMessage(teamResult.error?.message || matchResult.error?.message || inningsResult.error?.message || playerResult.error?.message || ballResult.error?.message || "");
        setLoading(false);
    }, [selectedTournament]);
    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);
    const batting = useMemo(() => [...stats].sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate), [stats]);
    const bowling = useMemo(() => [...stats].filter((row) => row.bowlingBalls > 0).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy), [stats]);
    const tournamentName = tournaments.find((item) => item.id === selectedTournament)?.name || "Tournament";
    const chartData = useMemo(() => batting.slice(0, 6).map((row) => ({ name: row.playerName.split(" ").slice(0, 2).join(" "), runs: row.runs, wickets: row.wickets })), [batting]);
    const downloadPng = async () => {
        if (!reportRef.current)
            return;
        setExporting(true);
        setMessage("");
        try {
            const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: admin ? "#08172e" : "#f8fafc" });
            const link = document.createElement("a");
            link.download = `${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-statistics.png`;
            link.href = dataUrl;
            link.click();
        }
        catch {
            setMessage("Report image could not be generated. Please try again.");
        }
        finally {
            setExporting(false);
        }
    };
    const downloadCsv = () => {
        const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
        const mvpByPlayer = new Map(mvpStats.map((row) => [row.playerId, row]));
        const rows = stats.map((row) => [row.playerName, row.teamName, row.matches, row.runs, row.ballsFaced, row.highestScore, row.average.toFixed(2), row.strikeRate.toFixed(2), row.wickets, row.bestBowling, row.economy.toFixed(2), mvpByPlayer.get(row.playerId)?.mvpPoints || 0]);
        const csv = [["Player", "Team", "Matches", "Runs", "Balls", "Highest Score", "Average", "Strike Rate", "Wickets", "Best Bowling", "Economy", "MVP Points"], ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
        const link = document.createElement("a");
        link.download = `${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-statistics.csv`;
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const shareReport = async () => {
        const data = { title: `${tournamentName} Statistics`, text: `View ${tournamentName} batting and bowling statistics on CrickPulse.`, url: window.location.href };
        if (navigator.share)
            await navigator.share(data).catch(() => undefined);
        else {
            await navigator.clipboard.writeText(window.location.href);
            setMessage("Statistics link copied to clipboard.");
        }
    };
    return <div className={`mx-auto max-w-6xl space-y-6 ${text}`}><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.2em] text-primary">{t("eyebrow")}</p><h1 className="mt-1 text-3xl font-black">{t("title")}</h1><p className={`mt-2 ${admin ? "text-muted-foreground" : "text-slate-500"}`}>{t("description")}</p></div><div className="flex gap-2"><select aria-label={t("tournament")} value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 font-bold sm:min-w-64 ${card}`}>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" onClick={() => void load()} disabled={loading || !selectedTournament} aria-label={t("refresh")} className={`rounded-xl border px-3 text-primary disabled:opacity-50 ${card}`}><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}/></button></div></header>
    {message && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    {loading ? <div className={`grid min-h-64 place-items-center rounded-2xl border ${card}`}><Loader2 className="h-9 w-9 animate-spin text-primary"/></div> : !stats.length ? <div className={`rounded-2xl border border-dashed p-12 text-center ${card}`}><Activity className="mx-auto h-10 w-10 text-primary"/><p className="mt-3 font-black">{t("empty")}</p></div> : <><div className="flex flex-wrap gap-2 print:hidden"><ActionButton icon={<Download className="h-4 w-4"/>} label={exporting ? t("creatingPng") : t("downloadPng")} onClick={() => void downloadPng()} disabled={exporting}/><ActionButton icon={<FileDown className="h-4 w-4"/>} label={t("exportCsv")} onClick={downloadCsv}/><ActionButton icon={<Share2 className="h-4 w-4"/>} label={t("share")} onClick={() => void shareReport()}/><ActionButton icon={<Printer className="h-4 w-4"/>} label={t("printPdf")} onClick={() => window.print()}/></div><div ref={reportRef} className={`space-y-6 rounded-2xl p-3 sm:p-5 ${admin ? "bg-background" : "bg-slate-50"}`}><MvpLeaderboard rows={mvpStats} cardClass={card}/><div className={`rounded-2xl border p-5 ${card}`}><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("analytics")}</p><h2 className="mt-1 text-xl font-black">{t("performanceChart", { tournament: tournamentName })}</h2></div><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 28 }}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} height={60} fontSize={11}/><YAxis fontSize={11}/><Tooltip /><Bar dataKey="runs" fill="#06b6d4" radius={[6, 6, 0, 0]}/><Bar dataKey="wickets" fill="#10b981" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div><div className="mt-3 flex justify-center gap-5 text-xs font-bold"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-cyan-500"/>{t("runs")}</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500"/>{t("wickets")}</span></div></div><div className="grid gap-6 lg:grid-cols-2"><Leaderboard title={t("topRuns")} icon={<Trophy className="h-6 w-6 text-amber-500"/>} rows={batting.slice(0, 10)} mode="batting" cardClass={card}/><Leaderboard title={t("topWickets")} icon={<Target className="h-6 w-6 text-emerald-500"/>} rows={bowling.slice(0, 10)} mode="bowling" cardClass={card}/></div></div></>}
  </div>;
}
function MvpLeaderboard({ rows, cardClass }: {
    rows: MvpTournamentStat[];
    cardClass: string;
}) {
    const t = useTranslations("Statistics");
    return <section className={`overflow-hidden rounded-2xl border shadow-sm ${cardClass}`}><header className="flex flex-col gap-2 border-b border-inherit bg-gradient-to-r from-amber-500/15 via-primary/10 to-rose-500/15 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Medal className="h-7 w-7 text-amber-500"/><div><h2 className="text-xl font-black">{t("mvpTitle")}</h2><p className="text-xs text-muted-foreground">{t("mvpDescription")}</p></div></div><span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-primary"><Calculator className="h-4 w-4"/>{t("pointsBased")}</span></header>{rows.length ? <div className="divide-y divide-inherit">{rows.slice(0, 10).map((row, index) => <article key={row.playerId} className="grid gap-3 p-4 sm:grid-cols-[2rem_3rem_minmax(0,1fr)_auto] sm:items-center sm:p-5"><span className="text-center text-lg font-black text-primary">#{index + 1}</span>{row.photoUrl ? <img src={row.photoUrl} alt={`${row.playerName} profile`} className="h-12 w-12 rounded-full border-2 border-amber-400/40 object-cover object-top"/> : <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">{row.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}<div className="min-w-0"><p className="truncate font-black">{row.playerName}</p><p className="truncate text-xs text-muted-foreground">{row.teamName} · {t("completedMatches", { count: row.matches })}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem] font-bold"><MvpPointItem label={t("runs")} detail={`${row.runs} × 1`} points={row.runPoints}/><MvpPointItem label={t("boundaries")} detail={`${row.fours} 4s + ${row.sixes} 6s`} points={row.boundaryBonus}/><MvpPointItem label={t("wickets")} detail={`${row.wickets} × 25`} points={row.wicketPoints}/><MvpPointItem label={t("maidens")} detail={`${row.maidenOvers} × 12`} points={row.maidenPoints}/><MvpPointItem label={t("fielding")} detail={`${row.catches} C · ${row.stumpings} St · ${row.runOuts} RO`} points={row.fieldingPoints}/><MvpPointItem label={t("pom")} detail={`${row.playerOfMatchAwards} × 20`} points={row.playerOfMatchPoints}/></div></div><div className="text-left sm:text-right"><p className="text-3xl font-black text-primary">{row.mvpPoints}</p><p className="text-[0.65rem] font-black uppercase tracking-wider text-muted-foreground">{t("mvpPoints")}</p></div></article>)}</div> : <p className="p-8 text-center text-sm font-bold text-muted-foreground">{t("mvpEmpty")}</p>}<footer className="border-t border-inherit bg-muted/40 px-5 py-3 text-[0.68rem] font-semibold leading-5 text-muted-foreground">{t("mvpFormula")}</footer></section>;
}
function MvpPointItem({ label, detail, points }: {
    label: string;
    detail: string;
    points: number;
}) {
    return <span className="rounded-md border border-border bg-muted/60 px-2 py-1 text-muted-foreground"><strong className="text-foreground">{label}</strong> {detail} = <strong className="text-primary">{points} pts</strong></span>;
}
function ActionButton({ icon, label, onClick, disabled = false }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50">{icon}{label}</button>;
}
function Leaderboard({ title, icon, rows, mode, cardClass }: {
    title: string;
    icon: React.ReactNode;
    rows: PlayerTournamentStat[];
    mode: "batting" | "bowling";
    cardClass: string;
}) {
    return <section className={`overflow-hidden rounded-2xl border shadow-sm ${cardClass}`}><header className="flex items-center gap-3 border-b border-inherit p-5"><span>{icon}</span><h2 className="text-xl font-black">{title}</h2></header><div className="divide-y divide-inherit">{rows.map((row, index) => <article key={row.playerId} className="grid grid-cols-[1.5rem_3rem_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:p-5"><span className="text-center text-sm font-black text-primary">{index + 1}</span>{row.photoUrl ? <img src={row.photoUrl} alt={`${row.playerName} profile`} className="h-12 w-12 rounded-full border-2 border-primary/25 bg-muted object-cover object-top shadow-sm"/> : <span aria-label={`${row.playerName} profile placeholder`} className="grid h-12 w-12 place-items-center rounded-full border-2 border-primary/20 bg-primary/10 text-sm font-black text-primary">{row.playerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}<div className="min-w-0"><p className="truncate font-black">{row.playerName}</p><p className="truncate text-xs text-muted-foreground">{row.teamName} · {row.matches} match{row.matches === 1 ? "" : "es"}</p><p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{mode === "batting" ? `Avg ${row.average.toFixed(1)} · SR ${row.strikeRate.toFixed(1)} · HS ${row.highestScore}` : `Econ ${row.economy.toFixed(2)} · Best ${row.bestBowling}`}</p></div><div className="min-w-12 text-right"><p className="text-2xl font-black text-primary">{mode === "batting" ? row.runs : row.wickets}</p><p className="text-[0.65rem] font-black uppercase tracking-wider text-muted-foreground">{mode === "batting" ? "runs" : "wickets"}</p></div></article>)}</div></section>;
}
