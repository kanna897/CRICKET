"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity, Banknote, CheckCircle2, Download, Gavel,
  ImagePlus, Loader2, Pause, Play, RefreshCw, ShoppingBag, Trophy, UserRound,
  UsersRound, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { localePath } from "@/lib/locale-path";
import { uploadImage } from "@/lib/media";
import { recognizeAuctionCard } from "@/lib/auction-card-ocr";
import type { AuctionFilter as Filter, AuctionPlayer, HistoryRow, Purse, Session, Team, Tournament } from "@/features/auction/types";
import { AuctionEmpty as Empty, AuctionPlayerDetailsDialog, AuctionPlayerDialog, AuctionStat as Stat, AuctionStatus as Status, DownloadButton, HistoryPanel, SquadPanel } from "@/features/auction/components";
import { displaySerial, mapWithConcurrency, money, playerDetailsFromFilename, pretty } from "@/features/auction/utils";
import { subscribeWithMonitoring } from "@/lib/monitoring/realtime";
import { AuctionTopPicksPoster } from "@/components/auction-top-picks-poster";

export function LiveAuctionDashboard({ admin = false, userId, isMasterAdmin = false }: { admin?: boolean; userId?: string; isMasterAdmin?: boolean }) {
  const { locale } = useParams<{ locale: string }>();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<AuctionPlayer[]>([]);
  const [purses, setPurses] = useState<Purse[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<Filter>("available");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<AuctionPlayer | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayingRole, setEditPlayingRole] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [saleTeamId, setSaleTeamId] = useState("");
  const [winningBid, setWinningBid] = useState("");
  const [purseDrafts, setPurseDrafts] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [scanProgress, setScanProgress] = useState({ completed: 0, total: 0 });
  const [topPicksDownloadToken, setTopPicksDownloadToken] = useState(0);
  const [fixedSelected, setFixedSelected] = useState<AuctionPlayer | null>(null);
  const [fixedTeamId, setFixedTeamId] = useState("");
  const [fixedPoints, setFixedPoints] = useState("");

  useEffect(() => {
    void (async () => {
      const [tournamentResult, sessionResult] = await Promise.all([
        supabase.from("tournaments")
          .select("id,name,logo_url,organizer_id").is("deleted_at", null).order("created_at", { ascending: false }),
        admin
          ? Promise.resolve({ data: [] })
          : supabase.from("auction_sessions").select("tournament_id,status").eq("status", "completed"),
      ]);
      const completedTournamentIds = new Set(
        ((sessionResult.data || []) as Pick<Session, "tournament_id">[]).map((row) => row.tournament_id)
      );
      const rows = ((tournamentResult.data || []) as Tournament[]).filter((row) =>
        (admin ? isMasterAdmin || row.organizer_id === userId : !completedTournamentIds.has(row.id))
      );
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
      supabase.from("teams").select("id,name,logo_url").eq("tournament_id", tournamentId).is("deleted_at", null).order("name"),
      supabase.from("auction_players").select("*").eq("tournament_id", tournamentId).in("source_type", ["bulk_upload", "fixed_upload"]).order("registration_number"),
      supabase.from("auction_team_purses").select("*").eq("tournament_id", tournamentId),
      supabase.from("auction_history").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: false }).limit(100),
      supabase.from("auction_sessions").select("*").eq("tournament_id", tournamentId).maybeSingle(),
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

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase.channel(`auction-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_players", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_team_purses", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_sessions", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_history", filter: `tournament_id=eq.${tournamentId}` }, () => void load());
    subscribeWithMonitoring(channel, `auction-${tournamentId}`);
    return () => { void supabase.removeChannel(channel); };
  }, [load, tournamentId]);

  const team = useCallback((id: string | null) => teams.find((row) => row.id === id), [teams]);
  const current = players.find((row) => row.id === session?.current_auction_player_id)
    || players.find((row) => row.status === "live") || null;
  const auctionPlayers = players.filter((row) => row.source_type === "bulk_upload" && row.status !== "excluded");
  const fixedPlayers = players.filter((row) => row.source_type === "fixed_upload");
  const fixedAssigned = fixedPlayers.filter((row) => row.status === "fixed");
  const sold = auctionPlayers.filter((row) => row.status === "sold");
  const unsold = players.filter((row) => row.status === "unsold");
  const bids = sold.map((row) => Number(row.winning_bid || 0));
  const stats = {
    registered: auctionPlayers.length,
    available: auctionPlayers.filter((row) => row.status === "available").length,
    sold: sold.length,
    unsold: unsold.length,
    highest: bids.length ? Math.max(...bids) : 0,
    lowest: bids.length ? Math.min(...bids) : 0,
    average: bids.length ? bids.reduce((sum, bid) => sum + bid, 0) / bids.length : 0,
  };
  const filtered = auctionPlayers.filter((row) => row.status === filter);

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
      const { error } = await supabase.from("auction_team_purses").upsert(rows, { onConflict: "tournament_id,team_id" });
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
    const { error } = await supabase.from("auction_sessions").upsert(payload, { onConflict: "tournament_id" });
    if (error) setMessage(error.message);
    else if (status === "completed") {
      setMessage("Auction completed. Your 4K Top Picks JPG is being prepared.");
      setTopPicksDownloadToken((token) => token + 1);
    }
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
      const { data, error } = await supabase.rpc("create_bulk_auction_players", {
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

  async function uploadFixedPlayerCards(files: FileList | null) {
    if (!admin || !files?.length) return;
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > 500) return setMessage("Upload a maximum of 500 fixed player cards at a time.");
    const invalid = selectedFiles.find((file) => !["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) return setMessage(`${invalid.name}: upload a JPG or PNG smaller than 5 MB.`);
    setBusy("fixed-upload"); setMessage(""); setUploadProgress({ completed: 0, total: selectedFiles.length });
    try {
      const uploaded = await mapWithConcurrency(selectedFiles, 5, async (file) => {
        const media = await uploadImage(file, "auction-player-cards");
        setUploadProgress((progress) => ({ ...progress, completed: progress.completed + 1 }));
        return { card_url: media.url, ...playerDetailsFromFilename(file.name) };
      });
      const { data, error } = await supabase.rpc("create_fixed_auction_players", { p_tournament_id: tournamentId, p_players: uploaded });
      if (error) throw error;
      setMessage(`${data?.length || uploaded.length} fixed player cards uploaded.`);
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Fixed player-card upload failed."); }
    finally { setBusy(""); setUploadProgress({ completed: 0, total: 0 }); }
  }

  async function assignFixedPlayer() {
    if (!fixedSelected || !fixedTeamId || fixedPoints === "") return setMessage("Select a team and enter fixed points.");
    const points = Number(fixedPoints);
    if (!Number.isFinite(points) || points < 0) return setMessage("Enter valid fixed points.");
    setBusy("assign-fixed"); setMessage("");
    const { error } = await supabase.rpc("assign_fixed_auction_player", { p_auction_player_id: fixedSelected.id, p_team_id: fixedTeamId, p_points: points });
    if (error) setMessage(error.message);
    else { setMessage("Fixed player assigned. Team squad and purse updated; matching auction card hidden."); setFixedSelected(null); await load(); }
    setBusy("");
  }

  async function undoFixedPlayer(player: AuctionPlayer) {
    setBusy(`undo-${player.id}`); setMessage("");
    const { error } = await supabase.rpc("unassign_fixed_auction_player", { p_auction_player_id: player.id });
    if (error) setMessage(error.message);
    else { setMessage("Fixed assignment removed, points refunded and matching auction card restored."); setFixedSelected(null); await load(); }
    setBusy("");
  }

  async function scanPlayerCard(player: AuctionPlayer) {
    const cardUrl = player.player_card_url || player.photo_url;
    const recognized = await recognizeAuctionCard(cardUrl);
    if (!recognized.playerName) throw new Error("Player name could not be read. Use a clear 1080×1080 player card.");
    const { data, error } = await supabase.rpc("update_bulk_auction_player_text", {
      p_auction_player_id: player.id,
      p_player_name: recognized.playerName,
      p_playing_role: recognized.playingRole || "Player",
      p_registration_number: recognized.registrationNumber ?? undefined,
      p_contact_number: recognized.contactNumber ?? undefined,
      p_batting_style: recognized.battingStyle || undefined,
      p_bowling_style: recognized.bowlingStyle || undefined,
    });
    if (error) throw error;
    return data as AuctionPlayer;
  }

  async function scanExistingCards() {
    const pending = players.filter((player) =>
      player.player_name === "Player" || !player.ocr_serial_number || !player.contact_number
      || !player.batting_style || !player.bowling_style
    );
    if (!pending.length) return setMessage("All uploaded cards already have scanned text.");
    setBusy("ocr-all");
    setMessage("");
    setScanProgress({ completed: 0, total: pending.length });
    let failed = 0;
    let firstFailure = "";
    for (const player of pending) {
      try {
        await scanPlayerCard(player);
      } catch (reason) {
        failed += 1;
        if (!firstFailure) firstFailure = reason instanceof Error ? reason.message : "Unknown OCR error";
        console.error("Auction card OCR failed", { playerId: player.id, reason });
      }
      setScanProgress((progress) => ({ ...progress, completed: progress.completed + 1 }));
    }
    await load();
    setBusy("");
    setScanProgress({ completed: 0, total: 0 });
    setMessage(failed
      ? `${pending.length - failed} cards scanned. ${failed} failed. ${firstFailure}`
      : `${pending.length} player cards converted to clean text.`);
  }

  async function openPlayer(player: AuctionPlayer) {
    let resolvedPlayer = player;
    setBusy(player.id);
    setMessage("");
    try {
      if (admin && (player.player_name === "Player" || !player.ocr_serial_number
        || !player.contact_number || !player.batting_style || !player.bowling_style)) {
        resolvedPlayer = await scanPlayerCard(player);
      }
      setSelected(resolvedPlayer);
      setEditPlayerName(resolvedPlayer.player_name);
      setEditPlayingRole(resolvedPlayer.playing_role);
      setEditSerial(String(displaySerial(resolvedPlayer)));
      setSaleTeamId(resolvedPlayer.winning_team_id || "");
      setWinningBid(resolvedPlayer.winning_bid ? String(resolvedPlayer.winning_bid) : "");
      if (admin && resolvedPlayer.status === "available") {
        const { error } = await supabase.rpc("set_auction_player_live", {
          p_auction_player_id: resolvedPlayer.id,
        });
        if (error) throw error;
        await load();
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Player card text scan failed.");
    } finally {
      setBusy("");
    }
  }

  async function savePlayerText() {
    if (!selected || !editPlayerName.trim()) return setMessage("Enter the player name.");
    setBusy("save-player-text");
    const serial = Number(editSerial);
    const { data, error } = await supabase.rpc("update_bulk_auction_player_text", {
      p_auction_player_id: selected.id,
      p_player_name: editPlayerName.trim(),
      p_playing_role: editPlayingRole.trim() || "Player",
      p_registration_number: Number.isInteger(serial) && serial > 0 ? serial : undefined,
    });
    if (error) setMessage(error.message);
    else {
      setSelected(data as AuctionPlayer);
      setMessage("Player card text saved.");
      await load();
    }
    setBusy("");
  }

  async function confirmSale() {
    if (!selected || !saleTeamId || winningBid === "") return setMessage("Select a team and enter the winning bid.");
    setBusy("sell"); setMessage("");
    try {
      let playerToSell = selected;
      if (selected.source_type === "bulk_upload"
        && (!selected.contact_number || !selected.batting_style || !selected.bowling_style)) {
        playerToSell = await scanPlayerCard(selected);
        setSelected(playerToSell);
      }
      const bid = Number(winningBid);
      if (!Number.isFinite(bid) || bid < 0) throw new Error("Enter a valid winning bid.");
      const purse = purses.find((row) => row.team_id === saleTeamId);
      if (!purse) throw new Error("Configure and save this team's initial purse before confirming the sale.");
      const availablePurse = Number(purse.initial_purse) - Number(purse.total_spent);
      if (bid > availablePurse) throw new Error("Winning bid exceeds the team's remaining purse.");
      const soldTeamName = team(saleTeamId)?.name || "selected team";
      const { error } = await supabase.rpc("sell_auction_player", {
        p_auction_player_id: playerToSell.id, p_team_id: saleTeamId, p_winning_bid: bid,
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
    const { error } = await supabase.rpc("mark_auction_player_unsold", { p_auction_player_id: player.id });
    if (error) setMessage(error.message); else setSelected(null);
    await load(); setBusy("");
  }

  async function reopen(player: AuctionPlayer) {
    setBusy(player.id);
    const { error } = await supabase.rpc("reopen_auction_player", { p_auction_player_id: player.id });
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

      {admin && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Auction controls</h2><p className="text-sm text-muted-foreground">Complete hides this tournament from the public auction list. Start / Resume makes it visible again.</p></div><div className="flex gap-2"><button className="control" onClick={() => void setSessionStatus("live")}><Play className="mr-2 h-4 w-4"/>Start / Resume</button><button className="control" onClick={() => void setSessionStatus("paused")}><Pause className="mr-2 h-4 w-4"/>Pause</button><button className="control" onClick={() => void setSessionStatus("completed")}><CheckCircle2 className="mr-2 h-4 w-4"/>Complete & Hide</button></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{teams.map((row) => { const purse = purses.find((item) => item.team_id === row.id); return <label key={row.id} className="rounded-xl border border-border bg-muted/30 p-3 text-sm font-bold"><span className="flex items-center justify-between"><span>{row.name}</span><small className="text-muted-foreground">Spent {money(Number(purse?.total_spent || 0))}</small></span><input type="number" min={Number(purse?.total_spent || 0)} step="0.01" className="input mt-2" value={purseDrafts[row.id] || "0"} onChange={(event) => setPurseDrafts((currentDrafts) => ({ ...currentDrafts, [row.id]: event.target.value }))}/></label>})}</div><button disabled={busy === "purses"} onClick={() => void savePurses()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground">{busy === "purses" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>}Save Team Purses</button></section>}

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
          <button disabled={Boolean(busy)} onClick={() => void scanExistingCards()} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary px-5 py-3 font-black text-primary disabled:opacity-60">
            {busy === "ocr-all" ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <RefreshCw className="mr-2 h-5 w-5"/>}
            {busy === "ocr-all" ? `Scanning ${scanProgress.completed}/${scanProgress.total}` : "Scan Cards to Text"}
          </button>
        </div>
        {busy === "bulk-upload" && <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress.total ? uploadProgress.completed * 100 / uploadProgress.total : 0}%` }}/></div>}
      </section>}

      {admin && <section className="rounded-2xl border border-amber-400/40 bg-card p-5 text-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Retained inventory</p><h2 className="mt-1 text-xl font-black">Fixed Player Card Upload</h2><p className="mt-1 text-sm text-muted-foreground">Use the same S.No as the auction card. After assignment, the matching auction card hides automatically.</p></div><label className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 ${busy === "fixed-upload" ? "pointer-events-none opacity-60" : ""}`}>{busy === "fixed-upload" ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ImagePlus className="mr-2 h-5 w-5"/>}{busy === "fixed-upload" ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}` : "Upload Fixed Player Cards"}<input type="file" multiple accept="image/jpeg,image/png" className="sr-only" disabled={busy === "fixed-upload"} onChange={(event) => { void uploadFixedPlayerCards(event.target.files); event.target.value = ""; }}/></label></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{fixedPlayers.map((player) => <button key={player.id} onClick={() => { setFixedSelected(player); setFixedTeamId(player.winning_team_id || ""); setFixedPoints(player.winning_bid === null ? "" : String(player.winning_bid)); }} className="overflow-hidden rounded-lg border border-amber-400/30 bg-background text-left shadow-sm"><div className="relative aspect-square"><Image unoptimized width={128} height={128} src={player.player_card_url || player.photo_url} alt={player.player_name} className="h-full w-full object-cover"/><span className={`absolute right-1 top-1 rounded-full px-2 py-1 text-[.6rem] font-black ${player.status === "fixed" ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-950"}`}>{player.status === "fixed" ? "FIXED" : "UNASSIGNED"}</span></div><div className="p-2"><strong className="block truncate text-xs">{player.player_name}</strong><span className="font-mono text-[.62rem] font-black text-amber-600">S.NO {String(displaySerial(player)).padStart(2, "0")}</span>{player.status === "fixed" && <><span className="block truncate text-[.65rem] font-bold text-emerald-600">{team(player.winning_team_id)?.name}</span><span className="text-[.65rem] font-black text-emerald-600">{money(Number(player.winning_bid || 0))} points</span></>}</div></button>)}</div>
        {!fixedPlayers.length && <p className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-sm font-bold text-muted-foreground">No fixed player cards uploaded yet.</p>}
      </section>}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#071631] to-[#0b3470] p-5 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Current auction player</p>{current ? <div className="mt-4 grid gap-5 sm:grid-cols-[14rem_1fr]"><Image unoptimized width={128} height={128} src={current.player_card_url || current.photo_url} alt={current.player_name} className="aspect-square w-full rounded-2xl border border-white/20 object-cover"/><div className="flex flex-col justify-center"><span className="font-mono text-2xl font-black text-amber-300">S.NO {String(displaySerial(current)).padStart(2, "0")}</span><h2 className="mt-2 text-3xl font-black">{current.player_name}</h2><p className="mt-2 capitalize text-slate-200">{pretty(current.playing_role)}</p>{admin && <button onClick={() => void openPlayer(current)} className="mt-5 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950">Sell / Mark Unsold</button>}</div></div> : <div className="grid min-h-64 place-items-center text-center text-slate-300"><div><Gavel className="mx-auto h-12 w-12 text-amber-300"/><p className="mt-3 font-bold">No player is live right now.</p></div></div>}</div>
        <div className="rounded-3xl border border-border bg-card p-5 text-foreground"><h2 className="text-xl font-black">Team purse & squad status</h2><div className="mt-4 space-y-3">{teams.map((row) => { const purse = purses.find((item) => item.team_id === row.id); const teamSold = sold.filter((player) => player.winning_team_id === row.id); return <article key={row.id} className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3">{row.logo_url ? <Image unoptimized width={128} height={128} src={row.logo_url} alt="" className="h-10 w-10 rounded-full object-contain"/> : <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-black">{row.name[0]}</span>}<div className="min-w-0 flex-1"><h3 className="truncate font-black">{row.name}</h3><p className="text-xs text-muted-foreground">{teamSold.length} purchased players</p></div><strong className="text-sm text-emerald-600">{money(Number(purse?.initial_purse || 0) - Number(purse?.total_spent || 0))} left</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${purse?.initial_purse ? Math.min(100, Number(purse.total_spent) * 100 / Number(purse.initial_purse)) : 0}%` }}/></div></article>})}</div></div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 text-foreground"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{pretty(filter)} players</h2><p className="text-sm text-muted-foreground">Sold and unsold players automatically move out of Available into their own section.</p></div><div className="flex flex-wrap gap-2">{(["available","live","sold","unsold"] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-black capitalize ${filter === item ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item} ({players.filter((player) => player.status === item).length})</button>)}</div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{filtered.map((player) => <button key={player.id} disabled={busy === player.id} onClick={() => void openPlayer(player)} aria-label={`View ${player.player_name} auction details`} className="overflow-hidden rounded-lg border border-border bg-background text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="relative aspect-square overflow-hidden"><Image unoptimized width={128} height={128} src={player.player_card_url || player.photo_url} alt={player.player_name} className="h-full w-full object-cover"/><Status value={player.status}/>{busy === player.id && <span className="absolute inset-0 grid place-items-center bg-black/60 text-[.65rem] font-black text-white"><Loader2 className="mr-1 h-4 w-4 animate-spin"/>Reading text</span>}</div><div className="p-2"><div className="flex items-center justify-between gap-1"><strong className="truncate text-xs">{player.player_name}</strong><span className="shrink-0 font-mono text-[.62rem] font-black text-primary">S.NO {String(displaySerial(player)).padStart(2, "0")}</span></div><p className="mt-0.5 truncate text-[.65rem] capitalize text-muted-foreground">{pretty(player.playing_role)}</p>{player.status === "sold" && <><strong className="mt-1 block truncate text-[.65rem] text-emerald-600">{team(player.winning_team_id)?.name || "Sold"}</strong><span className="block text-[.65rem] font-black text-emerald-600">{money(Number(player.winning_bid || 0))} points</span></>}</div></button>)}</div></section>

      <section className="grid gap-5 xl:grid-cols-2"><SquadPanel teams={teams} players={[...fixedAssigned, ...sold]}/><HistoryPanel history={history} players={players} teams={teams}/></section>

      {admin && sold.length > 0 && <AuctionTopPicksPoster
        tournamentName={tournaments.find((row) => row.id === tournamentId)?.name || "Tournament"}
        tournamentLogo={tournaments.find((row) => row.id === tournamentId)?.logo_url}
        players={sold}
        teams={teams}
        autoDownloadToken={topPicksDownloadToken}
        onDownloadComplete={() => {
          if (topPicksDownloadToken) setMessage("Auction completed and the 4K Top Picks JPG was downloaded.");
        }}
      />}

      {admin && <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex items-center gap-3"><Download className="h-6 w-6 text-primary"/><div><h2 className="text-xl font-black">Bulk Card Downloads</h2><p className="text-sm text-muted-foreground">Download uploaded auction cards inside a ZIP archive.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><DownloadButton label="All Player Cards" busy={busy === "zip-all"} onClick={() => void downloadZip("all")}/><DownloadButton label="Sold Cards" busy={busy === "zip-sold"} onClick={() => void downloadZip("sold")}/><DownloadButton label="Unsold Cards" busy={busy === "zip-unsold"} onClick={() => void downloadZip("unsold")}/></div></section>}
    </>}

    {admin && selected && <AuctionPlayerDialog
      selected={selected} teams={teams} selectedPurse={selectedPurse} busy={busy}
      editPlayerName={editPlayerName} editPlayingRole={editPlayingRole} editSerial={editSerial}
      saleTeamId={saleTeamId} winningBid={winningBid} availableBeforeBid={availableBeforeBid}
      remaining={remaining} saleBlocked={saleBlocked} teamName={(teamId) => team(teamId)?.name}
      onClose={() => setSelected(null)} onEditPlayerName={setEditPlayerName}
      onEditPlayingRole={setEditPlayingRole} onEditSerial={setEditSerial}
      onSaleTeamId={setSaleTeamId} onWinningBid={setWinningBid}
      onSaveText={() => void savePlayerText()} onReopen={() => void reopen(selected)}
      onUnsold={() => void markUnsold(selected)} onConfirmSale={() => void confirmSale()}
    />}
    {!admin && selected && <AuctionPlayerDetailsDialog
      selected={selected} teamName={(teamId) => team(teamId)?.name} onClose={() => setSelected(null)}
    />}
    {admin && fixedSelected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={() => setFixedSelected(null)}><div role="dialog" aria-modal="true" aria-label="Assign fixed player" className="w-full max-w-lg rounded-2xl border border-amber-400/40 bg-card p-5 text-foreground shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start gap-4"><Image unoptimized width={128} height={128} src={fixedSelected.player_card_url || fixedSelected.photo_url} alt={fixedSelected.player_name} className="h-28 w-28 rounded-xl object-cover"/><div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-amber-500">Fixed player</p><h2 className="truncate text-xl font-black">{fixedSelected.player_name}</h2><p className="text-sm text-muted-foreground">S.NO {String(displaySerial(fixedSelected)).padStart(2, "0")}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Team<select className="input mt-2" value={fixedTeamId} disabled={fixedSelected.status === "fixed"} onChange={(event) => setFixedTeamId(event.target.value)}><option value="">Select team</option>{teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-sm font-bold">Fixed points<input className="input mt-2" type="number" min="0" step="0.01" value={fixedPoints} disabled={fixedSelected.status === "fixed"} onChange={(event) => setFixedPoints(event.target.value)}/></label></div><div className="mt-5 flex flex-wrap justify-end gap-2"><button className="rounded-xl border border-border px-4 py-2 font-black" onClick={() => setFixedSelected(null)}>Cancel</button>{fixedSelected.status === "fixed" ? <button disabled={busy === `undo-${fixedSelected.id}`} className="rounded-xl bg-red-600 px-4 py-2 font-black text-white disabled:opacity-60" onClick={() => void undoFixedPlayer(fixedSelected)}>{busy === `undo-${fixedSelected.id}` ? "Removing..." : "Remove & Refund"}</button> : <button disabled={busy === "assign-fixed"} className="rounded-xl bg-amber-400 px-4 py-2 font-black text-slate-950 disabled:opacity-60" onClick={() => void assignFixedPlayer()}>{busy === "assign-fixed" ? "Assigning..." : "Confirm Fixed Player"}</button>}</div></div></div>}
  </div>;
}
