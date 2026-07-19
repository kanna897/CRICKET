"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateCommentary } from "@/lib/commentary";
import { LiveCommentary } from "@/components/live-commentary";

type Match = { id: string; team_a_id: string; team_b_id: string; overs_per_match: number; status: string; toss_winner_id: string | null; toss_decision: string | null; player_of_match_id: string | null; player_of_match_summary: string | null };
type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
type Player = { id: string; name: string; team_id: string | null; playing_role: string | null; photo_url: string | null };
type Innings = { id: string; innings_number: number; batting_team_id: string; bowling_team_id: string; total_runs: number; total_wickets: number; balls_bowled: number; extras: number; target: number | null; is_completed: boolean; striker_id: string | null; non_striker_id: string | null; current_bowler_id: string | null };
type Ball = { id: string; over_number: number; ball_number: number; runs: number; extras: number; extras_type: string | null; is_legal: boolean; is_wicket: boolean; dismissal_type: string | null; batsman_id: string | null; non_striker_id: string | null; bowler_id: string | null };
type Setup = { battingTeam: string; striker: string; nonStriker: string; bowler: string };

export default function LiveScorer() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [tossOpen, setTossOpen] = useState(false);
  const [nextBowlerOpen, setNextBowlerOpen] = useState(false);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [setup, setSetup] = useState<Setup>({ battingTeam: "", striker: "", nonStriker: "", bowler: "" });
  const [newBowler, setNewBowler] = useState("");
  const [wicketType, setWicketType] = useState("bowled");
  const [playerOut, setPlayerOut] = useState("");
  const [nextBatter, setNextBatter] = useState("");
  const [fielder, setFielder] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [boundaryPop, setBoundaryPop] = useState<{ runs: 4 | 6; key: number } | null>(null);
  const [wicketPop, setWicketPop] = useState<{ type: string; key: number } | null>(null);
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("bat");

  useEffect(() => {
    async function load() {
      const { data: matchData } = await (supabase.from("matches") as any).select("*").eq("id", id).maybeSingle();
      if (!matchData) { setLoading(false); return; }
      const [{ data: teamRows }, { data: playerRows }, { data: squadRows }, { data: inningsRow }] = await Promise.all([
        (supabase.from("teams") as any).select("id,name,logo_url,primary_color").in("id", [matchData.team_a_id, matchData.team_b_id]),
        (supabase.from("players") as any).select("id,name,team_id,playing_role,photo_url").order("name"),
        (supabase.from("match_squads") as any).select("player_id").eq("match_id", id),
        (supabase.from("innings") as any).select("*").eq("match_id", id).order("innings_number", { ascending: false }).limit(1).maybeSingle(),
      ]);
      let activeInnings = inningsRow || null;
      if (inningsRow?.innings_number === 1 && inningsRow.is_completed) {
        const { data: secondInnings } = await (supabase.from("innings") as any).insert({ match_id: matchData.id, innings_number: 2, batting_team_id: inningsRow.bowling_team_id, bowling_team_id: inningsRow.batting_team_id, target: inningsRow.total_runs + 1 }).select("*").maybeSingle();
        if (secondInnings) activeInnings = secondInnings;
        else {
          const { data: existingSecondInnings } = await (supabase.from("innings") as any).select("*").eq("match_id", id).eq("innings_number", 2).maybeSingle();
          if (existingSecondInnings) activeInnings = existingSecondInnings;
        }
      }
      setMatch(matchData); setTeams(teamRows || []); setPlayers(playerRows || []); setSquadPlayerIds((squadRows || []).map((row: { player_id: string }) => row.player_id)); setInnings(activeInnings);
      setTossWinner(matchData.toss_winner_id || matchData.team_a_id); setTossDecision(matchData.toss_decision || "bat");
      if (activeInnings) {
        const { data: ballRows } = await (supabase.from("ball_by_ball") as any).select("*").eq("innings_id", activeInnings.id).order("created_at", { ascending: false });
        setBalls((ballRows || []).reverse());
      }
      const batting = matchData.toss_winner_id && matchData.toss_decision
        ? (matchData.toss_decision === "bat" ? matchData.toss_winner_id : (matchData.toss_winner_id === matchData.team_a_id ? matchData.team_b_id : matchData.team_a_id))
        : matchData.team_a_id;
      setSetup({ battingTeam: activeInnings?.batting_team_id || batting, striker: activeInnings?.striker_id || "", nonStriker: activeInnings?.non_striker_id || "", bowler: activeInnings?.current_bowler_id || "" });
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  useEffect(() => {
    const refreshPlayerPhotos = async () => {
      const { data } = await (supabase.from("players") as any).select("id,photo_url");
      if (!data) return;
      const photos = new Map<string, string | null>();
      data.forEach((player: { id: string; photo_url: string | null }) => photos.set(player.id, player.photo_url));
      setPlayers((current) => current.map((player) => ({ ...player, photo_url: photos.get(player.id) ?? player.photo_url })));
    };
    void refreshPlayerPhotos();
    const timer = window.setInterval(refreshPlayerPhotos, 10000);
    window.addEventListener("focus", refreshPlayerPhotos);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshPlayerPhotos); };
  }, []);

  const playerName = (playerId: string | null) => players.find((player) => player.id === playerId)?.name || "Select player";
  const playerPhoto = (playerId: string | null) => players.find((player) => player.id === playerId)?.photo_url || null;
  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name || "Team";
  const candidates = (teamId: string) => {
    const selected = players.filter((player) => player.team_id === teamId && squadPlayerIds.includes(player.id));
    if (selected.length) return selected;
    const assigned = players.filter((player) => player.team_id === teamId);
    return assigned.length ? assigned : players;
  };
  const battingPlayers = candidates(setup.battingTeam);
  const bowlingTeam = match ? (setup.battingTeam === match.team_a_id ? match.team_b_id : match.team_a_id) : "";
  const bowlingPlayers = candidates(bowlingTeam);
  const score = innings ? `${innings.total_runs}/${innings.total_wickets}` : "0/0";
  const overs = innings ? `${Math.floor(innings.balls_bowled / 6)}.${innings.balls_bowled % 6}` : "0.0";
  const completed = match?.status === "completed" || innings?.is_completed;
  const winningTeamId = completed && innings?.innings_number === 2 && innings.target
    ? innings.total_runs >= innings.target ? innings.batting_team_id : innings.total_runs === innings.target - 1 ? null : innings.bowling_team_id
    : null;
  const winningTeam = teams.find((team) => team.id === winningTeamId) || null;
  const playerOfMatch = players.find((player) => player.id === match?.player_of_match_id) || null;
  const teamA = teams.find((team) => team.id === match?.team_a_id) || null;
  const teamB = teams.find((team) => team.id === match?.team_b_id) || null;
  const requiresSetup = !innings?.striker_id || !innings?.non_striker_id || !innings?.current_bowler_id;

  useEffect(() => {
    if (!winningTeamId) { setShowCelebration(false); return; }
    setShowCelebration(true);
    const timeout = window.setTimeout(() => setShowCelebration(false), 120000);
    return () => window.clearTimeout(timeout);
  }, [winningTeamId]);
  useEffect(() => {
    if (!boundaryPop) return;
    const timeout = window.setTimeout(() => setBoundaryPop(null), 900);
    return () => window.clearTimeout(timeout);
  }, [boundaryPop]);
  useEffect(() => {
    if (!wicketPop) return;
    const timeout = window.setTimeout(() => setWicketPop(null), 1050);
    return () => window.clearTimeout(timeout);
  }, [wicketPop]);
  const batterStats = (playerId: string | null) => {
    if (!playerId) return { runs: 0, balls: 0 };
    return balls.reduce((stats, ball) => ball.batsman_id === playerId
      ? { runs: stats.runs + ball.runs, balls: stats.balls + (ball.is_legal ? 1 : 0) }
      : stats, { runs: 0, balls: 0 });
  };
  const strikerStats = batterStats(innings?.striker_id || null);
  const nonStrikerStats = batterStats(innings?.non_striker_id || null);
  const currentOverNumber = balls.length ? balls[balls.length - 1].over_number : 0;
  const currentOverBalls = currentOverNumber ? balls.filter((ball) => ball.over_number === currentOverNumber) : [];
  const currentOverRuns = currentOverBalls.reduce((total, ball) => total + ball.runs + ball.extras, 0);
  const currentOverBowler = currentOverBalls[0]?.bowler_id || innings?.current_bowler_id || null;
  const currentOverBatter = currentOverBalls[0]?.batsman_id || innings?.striker_id || null;
  const maxOversPerBowler = Math.max(1, Math.ceil((match?.overs_per_match || 1) / 5));
  const legalBallsByBowler = (playerId: string) => balls.filter((ball) => ball.bowler_id === playerId && ball.is_legal).length;
  const eligibleNextBowlers = innings ? candidates(innings.bowling_team_id).filter((player) => player.id !== innings.current_bowler_id && legalBallsByBowler(player.id) < maxOversPerBowler * 6) : [];

  const saveInnings = async (next: Partial<Innings>) => {
    if (!innings) return;
    const { error } = await (supabase.from("innings") as any).update(next).eq("id", innings.id);
    if (error) throw error;
    setInnings({ ...innings, ...next });
  };

  const assignPlayerOfMatch = async (winnerTeamId?: string | null) => {
    if (!match) return null;
    const { data: inningsRows, error: inningsError } = await (supabase.from("innings") as any).select("id").eq("match_id", match.id);
    if (inningsError || !inningsRows?.length) return null;
    const { data: matchBalls, error: ballsError } = await (supabase.from("ball_by_ball") as any).select("batsman_id,bowler_id,runs,is_wicket,dismissal_type").in("innings_id", inningsRows.map((row: { id: string }) => row.id));
    if (ballsError || !matchBalls?.length) return null;
    const stats = new Map<string, { runs: number; wickets: number }>();
    const add = (playerId: string | null, field: "runs" | "wickets", amount: number) => {
      if (!playerId) return;
      const current = stats.get(playerId) || { runs: 0, wickets: 0 };
      current[field] += amount;
      stats.set(playerId, current);
    };
    matchBalls.forEach((ball: { batsman_id: string | null; bowler_id: string | null; runs: number; is_wicket: boolean; dismissal_type: string | null }) => {
      add(ball.batsman_id, "runs", ball.runs || 0);
      if (ball.is_wicket && ball.dismissal_type !== "run_out") add(ball.bowler_id, "wickets", 1);
    });
    const ranked = [...stats.entries()].map(([playerId, stat]) => ({
      playerId,
      stat,
      teamId: players.find((player) => player.id === playerId)?.team_id || null,
      impact: stat.runs + stat.wickets * 28 + (stat.runs >= 50 ? 12 : 0) + (stat.wickets >= 3 ? 12 : 0),
    })).sort((a, b) => b.impact - a.impact || b.stat.wickets - a.stat.wickets || b.stat.runs - a.stat.runs);
    const winnerCandidates = winnerTeamId ? ranked.filter((candidate) => candidate.teamId === winnerTeamId) : ranked;
    const winner = winnerCandidates[0] || ranked[0];
    if (!winner) return null;
    const { playerId, stat } = winner;
    const parts = [stat.runs ? `${stat.runs} run${stat.runs === 1 ? "" : "s"}` : "", stat.wickets ? `${stat.wickets} wicket${stat.wickets === 1 ? "" : "s"}` : ""].filter(Boolean);
    return { playerId, summary: parts.join(", ") || "Match contribution" };
  };

  const startInnings = async () => {
    if (!match || setup.striker === setup.nonStriker || !setup.striker || !setup.nonStriker || !setup.bowler) return alert("Choose two different batters and one bowler.");
    setSaving(true);
    try {
      const bowling = setup.battingTeam === match.team_a_id ? match.team_b_id : match.team_a_id;
      const payload = { match_id: match.id, innings_number: innings?.innings_number || 1, batting_team_id: setup.battingTeam, bowling_team_id: bowling, striker_id: setup.striker, non_striker_id: setup.nonStriker, current_bowler_id: setup.bowler };
      const result = innings ? await (supabase.from("innings") as any).update(payload).eq("id", innings.id).select("*").single() : await (supabase.from("innings") as any).insert(payload).select("*").single();
      if (result.error) throw result.error;
      setInnings(result.data); setSetupOpen(false);
    } catch (error) { alert(error instanceof Error ? error.message : "Unable to start innings."); }
    finally { setSaving(false); }
  };

  const record = async ({ runs = 0, extras = 0, extrasType, legal = true, wicket = false, dismissalType, outId, fielderId }: { runs?: number; extras?: number; extrasType?: string; legal?: boolean; wicket?: boolean; dismissalType?: string; outId?: string; fielderId?: string }) => {
    if (!innings || !match || saving || completed || innings.is_completed || requiresSetup) return;
    if (runs === 4 || runs === 6) setBoundaryPop({ runs, key: Date.now() });
    setSaving(true);
    try {
      const isOverEnd = legal && innings.balls_bowled % 6 === 5;
      const nextTotalRuns = innings.total_runs + runs + extras;
      const nextTotalWickets = innings.total_wickets + (wicket ? 1 : 0);
      const nextBallsBowled = innings.balls_bowled + (legal ? 1 : 0);
      const batterBefore = balls.filter((ball) => ball.batsman_id === innings.striker_id).reduce((total, ball) => total + ball.runs, 0);
      const bowlerBalls = balls.filter((ball) => ball.bowler_id === innings.current_bowler_id);
      const bowlerRuns = bowlerBalls.reduce((total, ball) => total + ball.runs + ball.extras, 0) + runs + extras;
      const bowlerWickets = bowlerBalls.filter((ball) => ball.is_wicket && ball.dismissal_type !== "run_out").length + (wicket && dismissalType !== "run_out" ? 1 : 0);
      const lastWicket = balls.map((ball) => ball.is_wicket).lastIndexOf(true);
      const partnership = balls.slice(lastWicket + 1).reduce((total, ball) => total + ball.runs + ball.extras, 0) + runs + extras;
      const allOut = wicket && nextTotalWickets >= Math.max(candidates(innings.batting_team_id).length - 1, 1);
      const oversComplete = nextBallsBowled >= match.overs_per_match * 6;
      const targetReached = innings.innings_number === 2 && Boolean(innings.target) && nextTotalRuns >= (innings.target || 0);
      const inningsComplete = allOut || oversComplete || targetReached;
      const matchResult = innings.innings_number === 2 && inningsComplete
        ? targetReached
          ? `MATCH WON! ${teamName(innings.batting_team_id)} win by ${Math.max(candidates(innings.batting_team_id).length - 1 - nextTotalWickets, 0)} wicket${Math.max(candidates(innings.batting_team_id).length - 1 - nextTotalWickets, 0) === 1 ? "" : "s"}.`
          : nextTotalRuns === (innings.target || 1) - 1
            ? "Match tied."
            : `MATCH WON! ${teamName(innings.bowling_team_id)} win by ${(innings.target || 1) - 1 - nextTotalRuns} run${(innings.target || 1) - 1 - nextTotalRuns === 1 ? "" : "s"}.`
        : undefined;
      const commentary = generateCommentary({
        over: Math.floor(innings.balls_bowled / 6) + 1,
        ball: innings.balls_bowled % 6 + 1,
        batterName: playerName(innings.striker_id),
        bowlerName: playerName(innings.current_bowler_id),
        runs,
        extras,
        extrasType: extrasType as "wide" | "no_ball" | "bye" | "leg_bye" | undefined,
        wicketType: dismissalType as "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket" | undefined,
        teamScore: nextTotalRuns,
        overs: `${Math.floor(nextBallsBowled / 6)}.${nextBallsBowled % 6}`,
        batterScore: batterBefore + runs,
        bowlerRuns,
        bowlerWickets,
        partnership,
        inningsComplete,
        matchResult,
      });
      let striker = innings.striker_id!; let nonStriker = innings.non_striker_id!;
      if (runs % 2 === 1 || (extrasType === "bye" || extrasType === "leg_bye") && extras % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
      if (isOverEnd) [striker, nonStriker] = [nonStriker, striker];
      if (wicket && outId === striker) striker = nextBatter || "";
      if (wicket && outId === nonStriker) nonStriker = nextBatter || "";
      const next = { total_runs: nextTotalRuns, total_wickets: nextTotalWickets, balls_bowled: nextBallsBowled, extras: (innings.extras || 0) + extras, overs_completed: Number(`${Math.floor(nextBallsBowled / 6)}.${nextBallsBowled % 6}`), is_completed: inningsComplete, striker_id: striker || null, non_striker_id: nonStriker || null };
      const { data: ball, error: ballError } = await (supabase.from("ball_by_ball") as any).insert({ innings_id: innings.id, over_number: Math.floor(innings.balls_bowled / 6) + 1, ball_number: innings.balls_bowled % 6 + 1, batsman_id: innings.striker_id, non_striker_id: innings.non_striker_id, bowler_id: innings.current_bowler_id, runs, extras, extras_type: extrasType || null, is_legal: legal, is_wicket: wicket, dismissal_type: dismissalType || null, player_out_id: outId || null, fielder_id: fielderId || null, commentary }).select("*").single();
      if (ballError) throw ballError;
      await saveInnings(next);
      setBalls([...balls, ball]);
      if (match.status === "scheduled") { const { error } = await (supabase.from("matches") as any).update({ status: "live" }).eq("id", match.id); if (error) throw error; setMatch({ ...match, status: "live" }); }
      if (inningsComplete && innings.innings_number === 1) {
        const { data: secondInnings, error: secondInningsError } = await (supabase.from("innings") as any).insert({ match_id: match.id, innings_number: 2, batting_team_id: innings.bowling_team_id, bowling_team_id: innings.batting_team_id, target: nextTotalRuns + 1 }).select("*").single();
        if (secondInningsError) throw secondInningsError;
        setInnings(secondInnings);
        setBalls([]);
        setSetup({ battingTeam: secondInnings.batting_team_id, striker: "", nonStriker: "", bowler: "" });
        setSetupOpen(true);
      }
      if (inningsComplete && innings.innings_number === 2) {
        const winnerId = targetReached ? innings.batting_team_id : nextTotalRuns === (innings.target || 1) - 1 ? null : innings.bowling_team_id;
        const playerOfMatch = await assignPlayerOfMatch(winnerId);
        const { error: finishError } = await (supabase.from("matches") as any).update({ status: "completed", winner_id: winnerId, player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }).eq("id", match.id);
        if (finishError) throw finishError;
        setMatch({ ...match, status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null });
      }
      if (isOverEnd) { setNewBowler(""); setNextBowlerOpen(true); }
      setWicketOpen(false); setNextBatter(""); setFielder("");
    } catch (error) { console.error("Scoring save failed", error); alert(error instanceof Error ? error.message : "Ball was not saved."); }
    finally { setSaving(false); }
  };

  const saveBowler = async () => {
    if (!innings || !newBowler) return;
    if (newBowler === innings.current_bowler_id) return alert("The same bowler cannot bowl consecutive overs.");
    if (legalBallsByBowler(newBowler) >= maxOversPerBowler * 6) return alert(`This bowler has completed the maximum ${maxOversPerBowler} overs.`);
    setSaving(true);
    try { await saveInnings({ current_bowler_id: newBowler }); setNextBowlerOpen(false); }
    catch { alert("Unable to update bowler."); }
    finally { setSaving(false); }
  };
  const saveToss = async () => {
    if (!match || !tossWinner) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from("matches") as any).update({ toss_winner_id: tossWinner, toss_decision: tossDecision }).eq("id", match.id);
      if (error) throw error;
      const battingTeam = tossDecision === "bat" ? tossWinner : (tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id);
      setMatch({ ...match, toss_winner_id: tossWinner, toss_decision: tossDecision });
      if (!innings) setSetup({ battingTeam, striker: "", nonStriker: "", bowler: "" });
      setTossOpen(false);
    } catch (error) { alert(error instanceof Error ? error.message : "Unable to save toss."); }
    finally { setSaving(false); }
  };
  const finish = async () => { if (!match || !confirm("Finish match and lock scoring?")) return; const playerOfMatch = await assignPlayerOfMatch(winningTeamId); const { error } = await (supabase.from("matches") as any).update({ status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }).eq("id", match.id); if (error) return alert("Unable to finish match."); setMatch({ ...match, status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }); };
  const undoLastBall = async () => {
    const lastBall = balls[balls.length - 1];
    if (!innings || !lastBall || saving || completed) return;
    if (!confirm("Undo the latest ball? This will restore the score before that ball.")) return;
    setSaving(true);
    try {
      const remaining = balls.slice(0, -1);
      const totalRuns = remaining.reduce((total, ball) => total + ball.runs + ball.extras, 0);
      const totalExtras = remaining.reduce((total, ball) => total + ball.extras, 0);
      const wickets = remaining.filter((ball) => ball.is_wicket).length;
      const legalBalls = remaining.filter((ball) => ball.is_legal).length;
      const { error: deleteError } = await (supabase.from("ball_by_ball") as any).delete().eq("id", lastBall.id);
      if (deleteError) throw deleteError;
      const restored = { total_runs: totalRuns, total_wickets: wickets, extras: totalExtras, balls_bowled: legalBalls, overs_completed: Number(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`), is_completed: false, striker_id: lastBall.batsman_id, non_striker_id: lastBall.non_striker_id, current_bowler_id: lastBall.bowler_id };
      const { error: restoreError } = await (supabase.from("innings") as any).update(restored).eq("id", innings.id);
      if (restoreError) throw restoreError;
      setInnings({ ...innings, ...restored });
      setBalls(remaining);
    } catch (error) { alert(error instanceof Error ? error.message : "Unable to undo the latest ball."); }
    finally { setSaving(false); }
  };
  const openWicket = (type: string) => { setWicketType(type); setWicketPop({ type, key: Date.now() }); setPlayerOut(innings?.striker_id || ""); setNextBatter(""); setFielder(""); setWicketOpen(true); };
  const saveWicket = () => {
    if (!nextBatter) return alert("Select the next batter.");
    if (["caught", "run_out", "stumped"].includes(wicketType) && !fielder) return alert("Select the fielder involved.");
    record({ wicket: true, dismissalType: wicketType, outId: playerOut, fielderId: fielder || undefined });
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  if (!match) return <div className="p-8 text-center text-red-600">Match not found.</div>;

  return <div className="live-score-shell max-w-5xl mx-auto space-y-4 pb-12">
    <header className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/admin/matches" className="p-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="font-bold text-xl">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)}</h1><p className="text-sm text-muted-foreground">{completed ? "Match completed" : saving ? "Saving ball…" : "Live scoring"}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={() => setTossOpen(true)} disabled={completed || saving} className="control">Toss</button><button onClick={() => setSetupOpen(true)} className="control"><Settings2 className="w-4 h-4 mr-1" />Setup</button><button onClick={finish} disabled={completed || saving} className="control bg-primary text-primary-foreground"><CheckCircle2 className="w-4 h-4 mr-1" />Finish</button>{completed && innings?.innings_number === 2 && innings.target ? <p className="w-full text-right text-xs font-bold uppercase tracking-wide text-foreground">{innings.total_runs >= innings.target ? `${teamName(innings.batting_team_id)} win by ${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0)} wicket${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0) === 1 ? "" : "s"}.` : innings.total_runs === innings.target - 1 ? "Match tied." : `${teamName(innings.bowling_team_id)} win by ${innings.target - 1 - innings.total_runs} run${innings.target - 1 - innings.total_runs === 1 ? "" : "s"}.`}</p> : match.toss_winner_id && match.toss_decision && <p className="w-full text-right text-xs uppercase tracking-wide text-muted-foreground"><strong className="text-foreground">{teamName(match.toss_winner_id)}</strong> have won the toss and have opted to <strong className="text-foreground">{match.toss_decision === "bat" ? "bat" : "bowl"}</strong>.</p>}</div></header>
    <div className="flex justify-end"><Link href={`/admin/matches/scorecard/${id}`} className="control"><FileText className="w-4 h-4 mr-1" />Scorecard & Match Summary</Link></div>
    {requiresSetup && <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">Choose batting team, opening pair and bowler before recording a ball. <button onClick={() => setSetupOpen(true)} className="underline font-semibold">Open setup</button></div>}
    <section className="bg-primary text-primary-foreground p-7 rounded-xl shadow-lg"><div className="flex justify-between text-sm opacity-80"><span>{innings ? `${teamName(innings.batting_team_id)} batting` : "Innings not started"}</span><span>Overs {overs} / {match.overs_per_match}.0</span></div><div className="grid grid-cols-[72px_1fr_72px] items-center gap-3 my-4"><div className="flex justify-center">{teamA?.logo_url ? <img src={teamA.logo_url} alt={teamA.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white" /> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_a_id).slice(0, 2)}</div>}</div><div className="relative text-center"><strong className="text-6xl">{score}</strong>{boundaryPop && <BoundaryPop key={boundaryPop.key} runs={boundaryPop.runs} />}{showCelebration && winningTeam && <ScoreCelebration color={winningTeam.primary_color || "#facc15"} teamName={winningTeam.name} />}<p className="mt-2">CRR: {innings?.balls_bowled ? ((innings.total_runs / innings.balls_bowled) * 6).toFixed(2) : "0.00"}</p></div><div className="flex justify-center">{teamB?.logo_url ? <img src={teamB.logo_url} alt={teamB.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white" /> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_b_id).slice(0, 2)}</div>}</div></div><div className="grid sm:grid-cols-3 gap-4 border-t border-white/20 pt-4 text-sm"><div className="flex items-center gap-3">{playerPhoto(innings?.striker_id || null) ? <img src={playerPhoto(innings?.striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-300" /> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">S</div>}<div><span className="opacity-70">Striker</span><p className="font-bold">{playerName(innings?.striker_id || null)} * <span className="text-yellow-300">{strikerStats.runs} ({strikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.non_striker_id || null) ? <img src={playerPhoto(innings?.non_striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/70" /> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">NS</div>}<div><span className="opacity-70">Non-striker</span><p className="font-bold">{playerName(innings?.non_striker_id || null)} <span className="text-yellow-300">{nonStrikerStats.runs} ({nonStrikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.current_bowler_id || null) ? <img src={playerPhoto(innings?.current_bowler_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-sky-300" /> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">B</div>}<div><span className="opacity-70">Bowler</span><p className="font-bold">{playerName(innings?.current_bowler_id || null)}</p></div></div></div></section>
    {winningTeam && <section className="overflow-hidden rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-950 shadow-sm"><div className="grid md:grid-cols-2"><div className="flex items-center gap-4 p-5">{winningTeam.logo_url ? <img src={winningTeam.logo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 bg-white" /> : <div className="h-14 w-14 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center font-black">WIN</div>}<div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Match won</p><p className="text-xl font-black">{winningTeam.name} WIN!</p><p className="text-sm font-semibold">A memorable victory by {(innings?.total_runs || 0) >= (innings?.target || Infinity) ? `${Math.max(candidates(innings?.batting_team_id || "").length - 1 - (innings?.total_wickets || 0), 0)} wickets` : `${(innings?.target || 1) - 1 - (innings?.total_runs || 0)} runs`}.</p></div></div>{match.player_of_match_id && <div className="flex items-center gap-3 border-t border-emerald-300/70 bg-white/45 p-5 md:border-l md:border-t-0">{playerOfMatch?.photo_url ? <img src={playerOfMatch.photo_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-400 ring-offset-2" /> : <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-black">POM</div>}<div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Player of the Match</p><p className="truncate text-lg font-black">{playerName(match.player_of_match_id)}</p><p className="text-sm font-semibold">{match.player_of_match_summary}</p></div></div>}</div></section>}
    {innings?.innings_number === 2 && innings.target && <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center"><div className="bg-card p-3"><p className="text-xs text-muted-foreground">TARGET</p><p className="font-bold text-lg">{innings.target}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">NEED</p><p className="font-bold text-lg">{Math.max(innings.target - innings.total_runs, 0)}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">BALLS LEFT</p><p className="font-bold text-lg">{Math.max(match.overs_per_match * 6 - innings.balls_bowled, 0)}</p></div></section>}
    <div className="grid lg:grid-cols-2 gap-4"><div className="space-y-3"><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold mb-3">Runs</h2><div className="grid grid-cols-3 gap-2">{[0,1,2,3,4,6].map((run) => <button key={run} onClick={() => record({ runs: run })} disabled={saving || completed || requiresSetup} className="score-button">{run}</button>)}</div></section><button onClick={undoLastBall} disabled={!balls.length || saving || completed} className="control w-full">Undo last ball</button></div><div className="space-y-4"><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold mb-3">Extras</h2><div className="grid grid-cols-4 gap-2">{[["Wd","wide",false],["NB","no_ball",false],["B","bye",true],["LB","leg_bye",true]].map(([label,type,legal]) => <button key={String(type)} onClick={() => record({ extras: 1, extrasType: String(type), legal: Boolean(legal) })} disabled={saving || completed || requiresSetup} className="small-button">{label}</button>)}</div></section><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold text-red-600 mb-3">Wicket</h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[["bowled","Bowled"],["caught","Caught"],["lbw","LBW"],["stumped","Stumping"],["run_out","Run Out"],["hit_wicket","Hit Wicket"]].map(([type,label]) => <button key={type} onClick={() => openWicket(type)} disabled={saving || completed || requiresSetup} className="small-button text-red-600">{label}</button>)}</div></section></div></div>
    <section className="bg-card border border-border rounded-xl overflow-hidden"><div className="grid grid-cols-[90px_1fr_86px] bg-emerald-50 dark:bg-emerald-950/30 border-b border-border px-4 py-2 text-xs text-muted-foreground"><span>Overs</span><span>Balls</span><span className="text-right">Runs</span></div>{currentOverBalls.length ? <div className="grid grid-cols-[90px_1fr_86px] min-h-20"><div className="border-r border-border px-4 py-4"><p className="font-medium">Ov {currentOverNumber}</p><p className="mt-2 text-sm text-muted-foreground">{innings ? `${innings.total_runs}-${innings.total_wickets}` : "0-0"}</p></div><div className="px-4 py-4 min-w-0"><p className="text-sm text-muted-foreground truncate">{playerName(currentOverBowler)} to {playerName(currentOverBatter)}</p><div className="flex flex-wrap gap-2 mt-2">{currentOverBalls.map((ball) => <span key={ball.id} title={`${ball.over_number}.${ball.ball_number}`} className={`inline-flex h-6 min-w-6 px-1 items-center justify-center rounded text-xs font-bold ${ball.is_wicket ? "bg-red-600 text-white" : ball.extras_type ? "bg-amber-500 text-white" : ball.runs === 4 || ball.runs === 6 ? "bg-sky-600 text-white" : "bg-muted text-foreground"}`}>{ball.is_wicket ? "W" : ball.extras_type === "wide" ? "Wd" : ball.extras_type === "no_ball" ? "NB" : ball.runs + ball.extras}</span>)}</div></div><div className="border-l border-border px-4 py-4 flex items-center justify-end font-bold">{currentOverRuns}</div></div> : <div className="px-4 py-5 text-sm text-muted-foreground">No balls recorded in this over.</div>}</section>
    {wicketPop && <WicketPop key={wicketPop.key} type={wicketPop.type} />}
    <LiveCommentary key={`${innings?.id || "new"}:${balls.length}`} inningsId={innings?.id || null} />
    {setupOpen && <Modal title={innings?.innings_number === 2 ? "Second innings setup" : "Start / correct innings"} onClose={() => setSetupOpen(false)}><Select label="Batting team" value={setup.battingTeam} onChange={(value) => setSetup({ battingTeam: value, striker: "", nonStriker: "", bowler: "" })} options={teams.map((team) => [team.id, team.name])} /><Select label="Striker" value={setup.striker} onChange={(value) => setSetup({ ...setup, striker: value })} options={battingPlayers.map((player) => [player.id, player.name])} /><Select label="Non-striker" value={setup.nonStriker} onChange={(value) => setSetup({ ...setup, nonStriker: value })} options={battingPlayers.filter((player) => player.id !== setup.striker).map((player) => [player.id, player.name])} /><Select label="First / current bowler" value={setup.bowler} onChange={(value) => setSetup({ ...setup, bowler: value })} options={bowlingPlayers.map((player) => [player.id, player.name])} /><ModalActions onCancel={() => setSetupOpen(false)} onSave={startInnings} saving={saving} label={innings?.innings_number === 2 ? "Start chase" : "Start scoring"} /></Modal>}
    {tossOpen && <Modal title="Match Toss" onClose={() => setTossOpen(false)}><Select label="Toss winner" value={tossWinner} onChange={setTossWinner} options={teams.map((team) => [team.id, team.name])} /><Select label="Decision" value={tossDecision} onChange={setTossDecision} options={[["bat", "Bat"], ["bowl", "Bowl"]]} /><ModalActions onCancel={() => setTossOpen(false)} onSave={saveToss} saving={saving} label="Save toss" /></Modal>}
    {nextBowlerOpen && <Modal title="Over complete — choose next bowler" onClose={() => setNextBowlerOpen(false)}><p className="mb-3 text-sm text-muted-foreground">Select a different bowler. Maximum {maxOversPerBowler} overs per bowler in this match.</p><Select label="Next bowler" value={newBowler} onChange={setNewBowler} options={eligibleNextBowlers.map((player) => [player.id, `${player.name} (${Math.floor(legalBallsByBowler(player.id) / 6)}.${legalBallsByBowler(player.id) % 6} ov)`])} /><ModalActions onCancel={() => setNextBowlerOpen(false)} onSave={saveBowler} saving={saving} label="Confirm bowler" /></Modal>}
    {wicketOpen && <Modal title={`Wicket — ${wicketType.replace("_", " ")}`} onClose={() => setWicketOpen(false)}><div className="rounded-md bg-muted p-3 text-sm"><span className="text-muted-foreground">Current bowler (auto): </span><strong>{playerName(innings?.current_bowler_id || null)}</strong></div><Select label="Player out" value={playerOut} onChange={setPlayerOut} options={[[innings?.striker_id || "", `${playerName(innings?.striker_id || null)} (striker)`],[innings?.non_striker_id || "", `${playerName(innings?.non_striker_id || null)} (non-striker)`]]} />{["caught","run_out","stumped"].includes(wicketType) && <Select label={wicketType === "run_out" ? "Run out completed by" : "Fielder"} value={fielder} onChange={setFielder} options={candidates(innings?.bowling_team_id || "").map((player) => [player.id, player.name])} />}<Select label="Next batter" value={nextBatter} onChange={setNextBatter} options={candidates(innings?.batting_team_id || "").filter((player) => player.id !== innings?.striker_id && player.id !== innings?.non_striker_id).map((player) => [player.id, player.name])} /><ModalActions onCancel={() => setWicketOpen(false)} onSave={saveWicket} saving={saving} label="Save wicket" /></Modal>}
  </div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><div className="bg-card rounded-xl p-6 w-full max-w-md space-y-4"><h2 className="text-xl font-bold">{title}</h2>{children}<button onClick={onClose} className="text-sm text-muted-foreground">Close</button></div></div>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2"><option value="">Select…</option>{options.filter(([value]) => value).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>; }
function ModalActions({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) { return <div className="flex justify-end gap-2 pt-2"><button onClick={onCancel} className="control">Cancel</button><button onClick={onSave} disabled={saving} className="control bg-primary text-primary-foreground">{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{label}</button></div>; }

function ScoreCelebration({ color, teamName }: { color: string; teamName: string }) { return <div aria-hidden="true" className="score-celebration" style={{ "--celebration-color": color } as React.CSSProperties}><span className="score-ribbon score-ribbon-one" /><span className="score-ribbon score-ribbon-two" /><span className="score-ribbon score-ribbon-three" /><span className="score-ribbon score-ribbon-four" /><span className="score-ribbon score-ribbon-five" /><span className="score-win-message">{teamName} WIN!</span></div>; }

function BoundaryPop({ runs }: { runs: 4 | 6 }) {
  return <span aria-hidden="true" className={`boundary-pop boundary-pop-${runs}`}>{runs === 4 ? "FOUR!" : "SIX!"}</span>;
}

function WicketPop({ type }: { type: string }) {
  const label = type.replace("_", " ").toUpperCase();
  return <div aria-hidden="true" className={`wicket-pop wicket-pop-${type}`}><span>WICKET!</span><strong>{label}</strong></div>;
}
