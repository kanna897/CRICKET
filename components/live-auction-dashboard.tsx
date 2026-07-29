"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity, Banknote, CheckCircle2, Clock3, Download, Gavel, History,
  ImagePlus, Loader2, Pause, Play, RefreshCw, ShoppingBag, Trophy, UserRound,
  UsersRound, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { localePath } from "@/lib/locale-path";
import { uploadImage } from "@/lib/media";

type Tournament = { id: string; name: string; organizer_id?: string | null };
type Team = { id: string; name: string; logo_url: string | null };
type AuctionPlayer = {
  id: string;
  tournament_id: string;
  registration_id: string;
  player_id: string | null;
  registration_number: number;
  player_name: string;
  photo_url: string;
  playing_role: string;
  batting_style: string;
  bowling_style: string;
  status: "available" | "live" | "sold" | "unsold";
  winning_team_id: string | null;
  winning_bid: number | null;
  sold_at: string | null;
  player_card_url: string | null;
  team_player_card_url: string | null;
  source_type: "registration" | "bulk_upload";
};
type Purse = { tournament_id: string; team_id: string; initial_purse: number; total_spent: number; purchased_count: number };
type Session = { tournament_id: string; status: "draft" | "live" | "paused" | "completed"; current_auction_player_id: string | null };
type HistoryRow = { id: number; auction_player_id: string; team_id: string | null; bid_amount: number | null; action: string; created_at: string };
type Filter = "all" | AuctionPlayer["status"];

export function LiveAuctionDashboard({ admin = false, userId, isMasterAdmin = false }: { admin?: boolean; userId?: string; isMasterAdmin?: boolean }) {
  const { locale } = useParams<{ locale: string }>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<AuctionPlayer[]>([]);
  const [purses, setPurses] = useState<Purse[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<AuctionPlayer | null>(null);
  const [saleTeamId, setSaleTeamId] = useState("");
  const [winningBid, setWinningBid] = useState("");
  const [purseDrafts, setPurseDrafts] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from("tournaments") as any)
        .select("id,name,organizer_id").is("deleted_at", null).order("created_at", { ascending: false });
      const rows = ((data || []) as Tournament[]).filter((row) => !admin || isMasterAdmin || row.organizer_id === userId);
      setTournaments(rows);
      const queryTournament = new URLSearchParams(window.location.search).get("tournament");
      setTournamentId(rows.some((row) => row.id === queryTournament) ? queryTournament! : rows[0]?.id || "");
      if (!rows.length) setLoading(false);
    })();
  }, [admin, isMasterAdmin, userId]);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    const [teamResult, playerResult, purseResult, historyResult, sessionResult] = await Promise.all([
      (supabase.from("teams") as any).select("id,name,logo_url").eq("tournament_id", tournamentId).is("deleted_at", null).order("name"),
      (supabase.from("auction_players") as any).select("*").eq("tournament_id", tournamentId).eq("source_type", "bulk_upload").order("registration_number"),
      (supabase.from("auction_team_purses") as any).select("*").eq("tournament_id", tournamentId),
      (supabase.from("auction_history") as any).select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: false }).limit(100),
      (supabase.from("auction_sessions") as any).select("*").eq("tournament_id", tournamentId).maybeSingle(),
    ]);
    const firstError = [teamResult.error, playerResult.error, purseResult.error, historyResult.error, sessionResult.error].find(Boolean);
    if (firstError) setMessage(firstError.message);
    setTeams((teamResult.data || []) as Team[]);
    setPlayers((playerResult.data || []) as AuctionPlayer[]);
    const nextPurses = (purseResult.data || []) as Purse[];
    setPurses(nextPurses);
    setPurseDrafts(Object.fromEntries(((teamResult.data || []) as Team[]).map((team) => [
      team.id,
      String(nextPurses.find((row) => row.team_id === team.id)?.initial_purse || 0),
    ])));
    setHistory((historyResult.data || []) as HistoryRow[]);
    setSession((sessionResult.data as Session | null) || null);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase.channel(`auction-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_players", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_team_purses", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_sessions", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_history", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, tournamentId]);

  const team = useCallback((id: string | null) => teams.find((row) => row.id === id), [teams]);
  const current = players.find((row) => row.id === session?.current_auction_player_id)
    || players.find((row) => row.status === "live") || null;
  const sold = players.filter((row) => row.status === "sold");
  const unsold = players.filter((row) => row.status === "unsold");
  const bids = sold.map((row) => Number(row.winning_bid || 0));
  const stats = {
    registered: players.length,
    available: players.filter((row) => row.status === "available").length,
    sold: sold.length,
    unsold: unsold.length,
    highest: bids.length ? Math.max(...bids) : 0,
    lowest: bids.length ? Math.min(...bids) : 0,
    average: bids.length ? bids.reduce((sum, bid) => sum + bid, 0) / bids.length : 0,
  };
  const filtered = filter === "all" ? players : players.filter((row) => row.status === filter);

  async function savePurses() {
    if (!admin) return;
    setBusy("purses"); setMessage("");
    try {
      const rows = teams.map((row) => {
        const existing = purses.find((purse) => purse.team_id === row.id);
        const initial = Number(purseDrafts[row.id] || 0);
        if (!Number.isFinite(initial) || initial < Number(existing?.total_spent || 0)) {
          throw new Error(`${row.name}: initial purse cannot be below current spending.`);
        }
        return {
          tournament_id: tournamentId,
          team_id: row.id,
          initial_purse: initial,
          total_spent: Number(existing?.total_spent || 0),
          purchased_count: Number(existing?.purchased_count || 0),
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await (supabase.from("auction_team_purses") as any).upsert(rows, { onConflict: "tournament_id,team_id" });
      if (error) throw error;
      setMessage("Team purses saved.");
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Purses could not be saved."); }
    finally { setBusy(""); }
  }

  async function setSessionStatus(status: Session["status"]) {
    setBusy(`session-${status}`); setMessage("");
    const payload = {
      tournament_id: tournamentId,
      status,
      started_at: status === "live" ? new Date().toISOString() : undefined,
      ended_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase.from("auction_sessions") as any).upsert(payload, { onConflict: "tournament_id" });
    if (error) setMessage(error.message);
    await load(); setBusy("");
  }

  async function uploadPlayerCards(files: FileList | null) {
    if (!admin || !files?.length) return;
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > 500) return setMessage("Upload a maximum of 500 player cards at a time.");
    const invalid = selectedFiles.find((file) =>
      !["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) return setMessage(`${invalid.name}: upload a JPG or PNG smaller than 5 MB.`);

    setBusy("bulk-upload");
    setMessage("");
    setUploadProgress({ completed: 0, total: selectedFiles.length });
    try {
      const uploaded = await mapWithConcurrency(selectedFiles, 5, async (file) => {
        const media = await uploadImage(file, "auction-player-cards");
        setUploadProgress((currentProgress) => ({
          ...currentProgress,
          completed: currentProgress.completed + 1,
        }));
        return { card_url: media.url, ...playerDetailsFromFilename(file.name) };
      });
      const { data, error } = await (supabase.rpc as any)("create_bulk_auction_players", {
        p_tournament_id: tournamentId,
        p_players: uploaded,
      });
      if (error) throw error;
      setMessage(`${data?.length || uploaded.length} player profile cards uploaded and added to Live Auction.`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Bulk player-card upload failed.");
    } finally {
      setBusy("");
      setUploadProgress({ completed: 0, total: 0 });
    }
  }

  async function openPlayer(player: AuctionPlayer) {
    setSelected(player); setSaleTeamId(player.winning_team_id || ""); setWinningBid(player.winning_bid ? String(player.winning_bid) : "");
    if (admin && player.status === "available") {
      setBusy(player.id);
      const { error } = await (supabase.rpc as any)("set_auction_player_live", { p_auction_player_id: player.id });
      if (error) setMessage(error.message);
      setBusy("");
      await load();
    }
  }

  async function confirmSale() {
    if (!selected || !saleTeamId || winningBid === "") return setMessage("Select a team and enter the winning bid.");
    setBusy("sell"); setMessage("");
    try {
      const bid = Number(winningBid);
      if (!Number.isFinite(bid) || bid < 0) throw new Error("Enter a valid winning bid.");
      const purse = purses.find((row) => row.team_id === saleTeamId);
      if (!purse) throw new Error("Configure and save this team's initial purse before confirming the sale.");
      const availablePurse = Number(purse.initial_purse) - Number(purse.total_spent);
      if (bid > availablePurse) throw new Error("Winning bid exceeds the team's remaining purse.");
      const soldTeamName = team(saleTeamId)?.name || "selected team";
      const { error } = await (supabase.rpc as any)("sell_auction_player", {
        p_auction_player_id: selected.id, p_team_id: saleTeamId, p_winning_bid: bid,
      });
      if (error) throw error;
      setSelected(null);
      await load();
      setMessage(`Player sold and added to ${soldTeamName}. Purse and squad updated.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Sale confirmation failed."); }
    finally { setBusy(""); }
  }

  async function markUnsold(player: AuctionPlayer) {
    setBusy("unsold"); setMessage("");
    const { error } = await (supabase.rpc as any)("mark_auction_player_unsold", { p_auction_player_id: player.id });
    if (error) setMessage(error.message); else setSelected(null);
    await load(); setBusy("");
  }

  async function reopen(player: AuctionPlayer) {
    setBusy(player.id);
    const { error } = await (supabase.rpc as any)("reopen_auction_player", { p_auction_player_id: player.id });
    if (error) setMessage(error.message);
    await load(); setBusy("");
  }

  async function downloadZip(kind: "all" | "team" | "sold" | "unsold") {
    setBusy(`zip-${kind}`); setMessage("");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const selectedPlayers = kind === "sold" ? sold : kind === "unsold" ? unsold : players;
      const urls = selectedPlayers.flatMap((player) => {
        if (kind === "team") return player.team_player_card_url ? [{ player, url: player.team_player_card_url, suffix: "team" }] : [];
        return player.player_card_url ? [{ player, url: player.player_card_url, suffix: "player" }] : [];
      });
      await Promise.all(urls.map(async ({ player, url, suffix }) => {
        const response = await fetch(url);
        if (!response.ok) return;
        zip.file(`${String(player.registration_number).padStart(2, "0")}-${player.player_name}-${suffix}.jpg`, await response.blob());
      }));
      if (!Object.keys(zip.files).length) throw new Error("No generated cards are available for this download.");
      const blob = await zip.generateAsync({ type: "blob" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `crickpulse-auction-${kind}.zip`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "ZIP download failed."); }
    finally { setBusy(""); }
  }

  const selectedPurse = purses.find((row) => row.team_id === saleTeamId);
  const availableBeforeBid = Number(selectedPurse?.initial_purse || 0) - Number(selectedPurse?.total_spent || 0);
  const enteredBid = winningBid.trim() === "" ? 0 : Number(winningBid);
  const validEnteredBid = Number.isFinite(enteredBid) && enteredBid >= 0;
  const remaining = availableBeforeBid - (validEnteredBid ? enteredBid : 0);
  const saleBlocked = !selectedPurse || !validEnteredBid || winningBid === "" || remaining < 0;

  return <div className={`${admin ? "admin-themed-page" : "mx-auto max-w-7xl"} space-y-6`}>
    <header className="flex flex-col gap-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-[#071631] via-[#0b3470] to-[#087b71] p-6 text-white shadow-xl sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">CrickPulse live room</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black"><Gavel className="h-8 w-8 text-amber-300"/>Live Player Auction</h1><p className="mt-2 text-sm text-slate-200">{admin ? "Run the auction, sell players and manage team purses." : "Watch every auction decision update live—no refresh required."}</p></div>
      <div className="flex flex-wrap gap-2"><select aria-label="Tournament" className="min-w-52 rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-bold text-white" value={tournamentId} onChange={(event) => setTournamentId(event.target.value)}>{tournaments.map((row) => <option className="text-slate-950" key={row.id} value={row.id}>{row.name}</option>)}</select>{admin ? <Link href={`${localePath(locale, "/auction")}?tournament=${tournamentId}`} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950">Open public auction</Link> : <span className={`rounded-xl px-4 py-2 text-sm font-black uppercase ${session?.status === "live" ? "bg-red-500 text-white" : "bg-white/15"}`}>{session?.status || "draft"}</span>}</div>
    </header>

    {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-foreground">{message}</p>}
    {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-primary"/></div> : !tournamentId ? <Empty text="No auction tournament is available."/> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Registered" value={stats.registered} icon={<UsersRound/>}/><Stat label="Available" value={stats.available} icon={<UserRound/>}/><Stat label="Sold" value={stats.sold} icon={<ShoppingBag/>}/><Stat label="Unsold" value={stats.unsold} icon={<X/>}/></section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Highest bid" value={money(stats.highest)} icon={<Trophy/>}/><Stat label="Lowest bid" value={money(stats.lowest)} icon={<Banknote/>}/><Stat label="Average bid" value={money(stats.average)} icon={<Activity/>}/><Stat label="Progress" value={`${stats.registered ? Math.round((stats.sold + stats.unsold) * 100 / stats.registered) : 0}%`} icon={<CheckCircle2/>}/></section>

      {admin && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Auction controls</h2><p className="text-sm text-muted-foreground">Start, pause or complete the public live room.</p></div><div className="flex gap-2"><button className="control" onClick={() => void setSessionStatus("live")}><Play className="mr-2 h-4 w-4"/>Start / Resume</button><button className="control" onClick={() => void setSessionStatus("paused")}><Pause className="mr-2 h-4 w-4"/>Pause</button><button className="control" onClick={() => void setSessionStatus("completed")}><CheckCircle2 className="mr-2 h-4 w-4"/>Complete</button></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{teams.map((row) => { const purse = purses.find((item) => item.team_id === row.id); return <label key={row.id} className="rounded-xl border border-border bg-muted/30 p-3 text-sm font-bold"><span className="flex items-center justify-between"><span>{row.name}</span><small className="text-muted-foreground">Spent {money(Number(purse?.total_spent || 0))}</small></span><input type="number" min={Number(purse?.total_spent || 0)} step="0.01" className="input mt-2" value={purseDrafts[row.id] || "0"} onChange={(event) => setPurseDrafts((currentDrafts) => ({ ...currentDrafts, [row.id]: event.target.value }))}/></label>})}</div><button disabled={busy === "purses"} onClick={() => void savePurses()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground">{busy === "purses" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>}Save Team Purses</button></section>}

      {admin && <section className="rounded-2xl border border-primary/30 bg-card p-5 text-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Auction inventory</p>
            <h2 className="mt-1 text-xl font-black">Bulk Player Profile Card Upload</h2>
            <p className="mt-1 text-sm text-muted-foreground">Upload 150+ finished JPG/PNG cards. Recommended filename: <strong>03 - KKKKK - All Rounder.jpg</strong>.</p>
          </div>
          <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground ${busy === "bulk-upload" ? "pointer-events-none opacity-60" : ""}`}>
            {busy === "bulk-upload" ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ImagePlus className="mr-2 h-5 w-5"/>}
            {busy === "bulk-upload" ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}` : "Upload Player Cards"}
            <input type="file" multiple accept="image/jpeg,image/png" className="sr-only" disabled={busy === "bulk-upload"} onChange={(event) => { void uploadPlayerCards(event.target.files); event.target.value = ""; }} />
          </label>
        </div>
        {busy === "bulk-upload" && <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress.total ? uploadProgress.completed * 100 / uploadProgress.total : 0}%` }}/></div>}
      </section>}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#071631] to-[#0b3470] p-5 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Current auction player</p>{current ? <div className="mt-4 grid gap-5 sm:grid-cols-[14rem_1fr]"><img src={current.player_card_url || current.photo_url} alt={current.player_name} className="aspect-square w-full rounded-2xl border border-white/20 object-cover"/><div className="flex flex-col justify-center"><span className="font-mono text-3xl font-black text-amber-300">#{String(current.registration_number).padStart(2, "0")}</span><h2 className="mt-2 text-3xl font-black">{current.player_name}</h2><p className="mt-2 capitalize text-slate-200">{pretty(current.playing_role)} · {pretty(current.batting_style)} · {pretty(current.bowling_style)}</p>{admin && <button onClick={() => void openPlayer(current)} className="mt-5 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950">Sell / Mark Unsold</button>}</div></div> : <div className="grid min-h-64 place-items-center text-center text-slate-300"><div><Gavel className="mx-auto h-12 w-12 text-amber-300"/><p className="mt-3 font-bold">No player is live right now.</p></div></div>}</div>
        <div className="rounded-3xl border border-border bg-card p-5 text-foreground"><h2 className="text-xl font-black">Team purse & squad status</h2><div className="mt-4 space-y-3">{teams.map((row) => { const purse = purses.find((item) => item.team_id === row.id); const teamSold = sold.filter((player) => player.winning_team_id === row.id); return <article key={row.id} className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3">{row.logo_url ? <img src={row.logo_url} alt="" className="h-10 w-10 rounded-full object-contain"/> : <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-black">{row.name[0]}</span>}<div className="min-w-0 flex-1"><h3 className="truncate font-black">{row.name}</h3><p className="text-xs text-muted-foreground">{teamSold.length} purchased players</p></div><strong className="text-sm text-emerald-600">{money(Number(purse?.initial_purse || 0) - Number(purse?.total_spent || 0))} left</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${purse?.initial_purse ? Math.min(100, Number(purse.total_spent) * 100 / Number(purse.initial_purse)) : 0}%` }}/></div></article>})}</div></div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Registered players</h2><p className="text-sm text-muted-foreground">Click a player card to open the auction action popup.</p></div><div className="flex flex-wrap gap-2">{(["all","available","live","sold","unsold"] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-black capitalize ${filter === item ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item}</button>)}</div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{filtered.map((player) => <button key={player.id} disabled={busy === player.id} onClick={() => void openPlayer(player)} className="overflow-hidden rounded-2xl border border-border bg-background text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="relative aspect-square overflow-hidden"><img src={player.player_card_url || player.photo_url} alt={player.player_name} className="h-full w-full object-cover"/><Status value={player.status}/></div><div className="p-4"><div className="flex items-center justify-between gap-2"><strong className="truncate">{player.player_name}</strong><span className="font-mono text-sm font-black text-primary">#{String(player.registration_number).padStart(2,"0")}</span></div><p className="mt-1 text-xs capitalize text-muted-foreground">{pretty(player.playing_role)} · {pretty(player.batting_style)}</p>{player.status === "sold" && <p className="mt-2 text-sm font-black text-emerald-600">{team(player.winning_team_id)?.name} · {money(Number(player.winning_bid || 0))}</p>}</div></button>)}</div></section>

      <section className="grid gap-5 xl:grid-cols-2"><SquadPanel teams={teams} players={sold}/><HistoryPanel history={history} players={players} teams={teams}/></section>

      {admin && <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex items-center gap-3"><Download className="h-6 w-6 text-primary"/><div><h2 className="text-xl font-black">Bulk Card Downloads</h2><p className="text-sm text-muted-foreground">Download uploaded auction cards inside a ZIP archive.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><DownloadButton label="All Player Cards" busy={busy === "zip-all"} onClick={() => void downloadZip("all")}/><DownloadButton label="Sold Cards" busy={busy === "zip-sold"} onClick={() => void downloadZip("sold")}/><DownloadButton label="Unsold Cards" busy={busy === "zip-unsold"} onClick={() => void downloadZip("unsold")}/></div></section>}
    </>}

    {admin && selected && (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
        <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm font-black text-primary">#{String(selected.registration_number).padStart(2, "0")}</p>
              <h2 className="text-2xl font-black">{selected.player_name}</h2>
              <p className="text-sm capitalize text-muted-foreground">{pretty(selected.playing_role)}</p>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-full bg-muted p-2"><X className="h-5 w-5" /></button>
          </div>
          {selected.status === "unsold" ? (
            <button onClick={() => void reopen(selected)} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground"><RefreshCw className="mr-2 inline h-4 w-4" />Reopen Player</button>
          ) : selected.status === "sold" ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-900">
              <strong>Sold to {team(selected.winning_team_id)?.name}</strong>
              <p>{money(Number(selected.winning_bid || 0))}</p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-bold">Winning Team
                  <select className="input" value={saleTeamId} onChange={(event) => setSaleTeamId(event.target.value)}>
                    <option value="">Select team</option>
                    {teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-bold">Winning Bid Amount
                  <input className="input" type="number" min="0" step=".01" value={winningBid} onChange={(event) => setWinningBid(event.target.value)} />
                </label>
              </div>
              {saleTeamId && !selectedPurse && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">Team purse is not configured. Set its Initial Purse in Auction Controls and click Save Team Purses.</p>}
              {saleTeamId && selectedPurse && <div className={`mt-3 rounded-lg border p-3 text-sm font-bold ${remaining < 0 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}><p>Available before bid: {money(availableBeforeBid)}</p><p className="mt-1 text-base">Remaining after this bid: {money(remaining)}</p>{remaining < 0 && <p className="mt-1 text-xs">Winning bid exceeds the available purse.</p>}</div>}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button disabled={busy === "unsold"} onClick={() => void markUnsold(selected)} className="rounded-xl border border-red-300 px-4 py-3 font-black text-red-600">Mark Unsold</button>
                <button disabled={busy === "sell" || saleBlocked} onClick={() => void confirmSale()} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "sell" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Confirm Sale</button>
              </div>
            </>
          )}
        </section>
      </div>
    )}
  </div>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <article className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span></div><p className="mt-3 text-2xl font-black">{value}</p></article>;
}
function Status({ value }: { value: AuctionPlayer["status"] }) {
  const style = value === "sold" ? "bg-emerald-500" : value === "live" ? "bg-red-500 animate-pulse" : value === "unsold" ? "bg-red-600" : "bg-sky-600";
  return <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[.65rem] font-black uppercase text-white ${style}`}>{value}</span>;
}
function SquadPanel({ teams, players }: { teams: Team[]; players: AuctionPlayer[] }) {
  return <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="flex items-center gap-2 text-xl font-black"><UsersRound className="h-5 w-5 text-primary"/>Team Squads</h2><div className="mt-4 space-y-4">{teams.map((team) => <article key={team.id}><h3 className="rounded-lg bg-muted px-3 py-2 font-black">{team.name}</h3><div className="divide-y divide-border">{players.filter((player) => player.winning_team_id === team.id).map((player) => <div key={player.id} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 py-3 text-sm"><img src={player.photo_url} alt={player.player_name} className="h-12 w-12 rounded-xl border border-border object-cover"/><span className="min-w-0"><strong className="block truncate">{player.player_name}</strong><small className="block capitalize text-muted-foreground">{pretty(player.playing_role)} · #{String(player.registration_number).padStart(2,"0")}</small></span><strong>{money(Number(player.winning_bid || 0))}</strong></div>)}</div></article>)}</div></section>;
}
function HistoryPanel({ history, players, teams }: { history: HistoryRow[]; players: AuctionPlayer[]; teams: Team[] }) {
  return <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="flex items-center gap-2 text-xl font-black"><History className="h-5 w-5 text-primary"/>Auction History</h2><div className="mt-4 max-h-[32rem] divide-y divide-border overflow-y-auto">{history.map((row) => { const player = players.find((item) => item.id === row.auction_player_id); const team = teams.find((item) => item.id === row.team_id); return <div key={row.id} className="flex items-center gap-3 py-3 text-sm"><Clock3 className="h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0 flex-1"><strong className="truncate">{player?.player_name || "Player"}</strong><p className="capitalize text-muted-foreground">{row.action}{team ? ` · ${team.name}` : ""}</p></div>{row.bid_amount !== null && <strong>{money(Number(row.bid_amount))}</strong>}<time className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>})}</div></section>;
}
function DownloadButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button disabled={busy} onClick={onClick} className="control">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}{label}</button>;
}
function Empty({ text }: { text: string }) { return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-border text-muted-foreground">{text}</div>; }
function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function money(value: number) { return new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(value || 0); }

function playerDetailsFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  const parts = base.split(/\s+(?:-|–|—)\s+|_+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length && /^\d+$/.test(parts[0])) parts.shift();
  const rolePattern = /^(all[\s_-]?rounder|batsman|batter|bowler|wicket[\s_-]?keeper|player)$/i;
  const rolePart = parts.length > 1 && rolePattern.test(parts.at(-1) || "") ? parts.pop()! : "Player";
  const playerName = parts.join(" - ").trim() || base.replace(/^\d+\s*/, "").trim() || "Player";
  return {
    player_name: playerName,
    playing_role: rolePart.replaceAll("-", " ").replaceAll("_", " "),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()));
  return results;
}
