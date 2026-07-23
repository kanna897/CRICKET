"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, BarChart3, CheckCircle2, FileText, Loader2, LockKeyhole, Mic, MicOff, RotateCcw, RotateCw, Settings2, Share2, SlidersHorizontal, UserPlus, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateCommentary } from "@/lib/commentary";
import { LiveCommentary } from "@/components/live-commentary";
import { getOfflineQueue, removeOfflineQueueItem, saveToOfflineQueue, type OfflineQueueItem } from "@/lib/offlineSync";
import { useAdminAccess } from "@/components/admin-shell";
type Match = {
    id: string;
    team_a_id: string;
    team_b_id: string;
    overs_per_match: number;
    status: string;
    toss_winner_id: string | null;
    toss_decision: string | null;
    player_of_match_id: string | null;
    player_of_match_summary: string | null;
    assigned_scorer_id: string | null;
    scoring_locked: boolean;
};
type Team = {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
};
type Player = {
    id: string;
    name: string;
    team_id: string | null;
    playing_role: string | null;
    photo_url: string | null;
};
type Innings = {
    id: string;
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    total_runs: number;
    total_wickets: number;
    balls_bowled: number;
    extras: number;
    target: number | null;
    is_completed: boolean;
    striker_id: string | null;
    non_striker_id: string | null;
    current_bowler_id: string | null;
};
type Ball = {
    id: string;
    client_event_id?: string;
    over_number: number;
    ball_number: number;
    runs: number;
    extras: number;
    extras_type: string | null;
    is_legal: boolean;
    is_wicket: boolean;
    dismissal_type: string | null;
    batsman_id: string | null;
    non_striker_id: string | null;
    bowler_id: string | null;
    player_out_id: string | null;
    commentary?: string | null;
};
type Setup = {
    battingTeam: string;
    striker: string;
    nonStriker: string;
    bowler: string;
};
type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
};
export default function LiveScorer() {
    const { userId, isMasterAdmin } = useAdminAccess();
    const { id } = useParams<{
        id: string;
    }>();
    const [match, setMatch] = useState<Match | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
    const [innings, setInnings] = useState<Innings | null>(null);
    const [balls, setBalls] = useState<Ball[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [tossOpen, setTossOpen] = useState(false);
    const [nextBowlerOpen, setNextBowlerOpen] = useState(false);
    const [newBatterOpen, setNewBatterOpen] = useState(false);
    const [wicketOpen, setWicketOpen] = useState(false);
    const [advancedDeliveryOpen, setAdvancedDeliveryOpen] = useState(false);
    const [advancedRuns, setAdvancedRuns] = useState(0);
    const [advancedExtras, setAdvancedExtras] = useState(1);
    const [advancedExtrasType, setAdvancedExtrasType] = useState("wide");
    const [setup, setSetup] = useState<Setup>({ battingTeam: "", striker: "", nonStriker: "", bowler: "" });
    const [newBowler, setNewBowler] = useState("");
    const [newBatter, setNewBatter] = useState("");
    const [batterSlot, setBatterSlot] = useState<"striker_id" | "non_striker_id">("striker_id");
    const [wicketType, setWicketType] = useState("bowled");
    const [playerOut, setPlayerOut] = useState("");
    const [nextBatter, setNextBatter] = useState("");
    const [fielder, setFielder] = useState("");
    const [showCelebration, setShowCelebration] = useState(false);
    const [boundaryPop, setBoundaryPop] = useState<{
        runs: 4 | 6;
        key: number;
    } | null>(null);
    const [wicketPop, setWicketPop] = useState<{
        type: string;
        key: number;
    } | null>(null);
    const [tossWinner, setTossWinner] = useState("");
    const [tossDecision, setTossDecision] = useState("bat");
    const [shotZone, setShotZone] = useState("straight");
    const [offlinePending, setOfflinePending] = useState(0);
    const [redoSnapshot, setRedoSnapshot] = useState<{ ball: Ball; innings: Innings } | null>(null);
    const [voiceListening, setVoiceListening] = useState(false);
    const [voiceMessage, setVoiceMessage] = useState("");
    const [autoCommentary, setAutoCommentary] = useState(false);
    const [commentaryVoice, setCommentaryVoice] = useState("en-IN");
    const lastSpokenCommentary = useRef("");

    useEffect(() => {
        setAutoCommentary(window.localStorage.getItem("crickpulse:auto-commentary") === "on");
        setCommentaryVoice(window.localStorage.getItem("crickpulse:commentary-voice") || "en-IN");
        return () => window.speechSynthesis?.cancel();
    }, []);

    const speakCommentary = (text: string) => {
        if (!autoCommentary || typeof window === "undefined" || !("speechSynthesis" in window))
            return;
        if (lastSpokenCommentary.current === text)
            return;
        lastSpokenCommentary.current = text;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = commentaryVoice;
        utterance.rate = 0.96;
        utterance.pitch = 1;
        const matchingVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang === commentaryVoice)
            || window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith(commentaryVoice.split("-")[0]));
        if (matchingVoice)
            utterance.voice = matchingVoice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    const toggleAutoCommentary = () => {
        if (!("speechSynthesis" in window))
            return alert("Automated commentary is not supported in this browser. Use Chrome, Edge or Safari.");
        const enabled = !autoCommentary;
        setAutoCommentary(enabled);
        window.localStorage.setItem("crickpulse:auto-commentary", enabled ? "on" : "off");
        if (!enabled)
            window.speechSynthesis.cancel();
        else {
            const preview = new SpeechSynthesisUtterance("CrickPulse automated commentary is ready.");
            preview.lang = commentaryVoice;
            window.speechSynthesis.speak(preview);
        }
    };

    const changeCommentaryVoice = (language: string) => {
        setCommentaryVoice(language);
        window.localStorage.setItem("crickpulse:commentary-voice", language);
    };
    useEffect(() => {
        async function load() {
            const { data: matchData } = await (supabase.from("matches") as any).select("*").eq("id", id).maybeSingle();
            if (!matchData) {
                setLoading(false);
                return;
            }
            if (matchData.scoring_locked && matchData.assigned_scorer_id !== userId && !isMasterAdmin) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }
            const [{ data: teamRows }, { data: playerRows }, { data: squadRows }, { data: inningsRow }] = await Promise.all([
                (supabase.from("teams") as any).select("id,name,logo_url,primary_color").in("id", [matchData.team_a_id, matchData.team_b_id]),
                (supabase.from("players") as any).select("id,name,team_id,playing_role,photo_url").order("name"),
                (supabase.from("match_squads") as any).select("player_id").eq("match_id", id),
                (supabase.from("innings") as any).select("*").eq("match_id", id).order("innings_number", { ascending: false }).limit(1).maybeSingle(),
            ]);
            let activeInnings = inningsRow || null;
            if (inningsRow?.innings_number === 1 && inningsRow.is_completed) {
                const { data: secondInnings } = await (supabase.from("innings") as any).insert({ match_id: matchData.id, innings_number: 2, batting_team_id: inningsRow.bowling_team_id, bowling_team_id: inningsRow.batting_team_id, target: inningsRow.total_runs + 1 }).select("*").maybeSingle();
                if (secondInnings)
                    activeInnings = secondInnings;
                else {
                    const { data: existingSecondInnings } = await (supabase.from("innings") as any).select("*").eq("match_id", id).eq("innings_number", 2).maybeSingle();
                    if (existingSecondInnings)
                        activeInnings = existingSecondInnings;
                }
            }
            setMatch(matchData);
            setTeams(teamRows || []);
            setPlayers(playerRows || []);
            setSquadPlayerIds((squadRows || []).map((row: {
                player_id: string;
            }) => row.player_id));
            setInnings(activeInnings);
            setTossWinner(matchData.toss_winner_id || matchData.team_a_id);
            setTossDecision(matchData.toss_decision || "bat");
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
        if (id)
            load();
    }, [id, isMasterAdmin, userId]);
    useEffect(() => {
        const syncPending = async () => {
            if (!navigator.onLine)
                return;
            const items = await getOfflineQueue() as OfflineQueueItem<{
                ball: Record<string, unknown>;
                inningsId: string;
                next: Record<string, unknown>;
            }>[];
            const current = items.filter((item) => item.matchId === id);
            setOfflinePending(current.length);
            let synced = 0;
            for (const item of current) {
                const ballResult = await (supabase.from("ball_by_ball") as any)
                    .upsert(item.payload.ball, { onConflict: "client_event_id", ignoreDuplicates: true });
                if (ballResult.error)
                    break;
                const inningsResult = await (supabase.from("innings") as any).update(item.payload.next).eq("id", item.payload.inningsId);
                if (inningsResult.error)
                    break;
                await removeOfflineQueueItem(item.id);
                synced++;
            }
            setOfflinePending(Math.max(current.length - synced, 0));
            if (synced)
                window.location.reload();
        };
        void (async () => { const items = await getOfflineQueue() as OfflineQueueItem[]; setOfflinePending(items.filter((item) => item.matchId === id).length); })();
        window.addEventListener("online", syncPending);
        return () => window.removeEventListener("online", syncPending);
    }, [id]);
    useEffect(() => {
        const refreshPlayerPhotos = async () => {
            const { data } = await (supabase.from("players") as any).select("id,photo_url");
            if (!data)
                return;
            const photos = new Map<string, string | null>();
            data.forEach((player: {
                id: string;
                photo_url: string | null;
            }) => photos.set(player.id, player.photo_url));
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
        if (selected.length)
            return selected;
        const assigned = players.filter((player) => player.team_id === teamId);
        return assigned.length ? assigned : players;
    };
    // Once the chase has been created, its two teams are fixed. This prevents
    // Setup from accidentally turning the second innings into the same team.
    const setupBattingTeam = innings?.innings_number === 2 ? innings.batting_team_id : setup.battingTeam;
    const battingPlayers = candidates(setupBattingTeam);
    const bowlingTeam = innings?.innings_number === 2 ? innings.bowling_team_id : (match ? (setupBattingTeam === match.team_a_id ? match.team_b_id : match.team_a_id) : "");
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
    const ballsRemaining = innings && match ? Math.max(match.overs_per_match * 6 - innings.balls_bowled, 0) : 0;
    const runsNeeded = innings?.target ? Math.max(innings.target - innings.total_runs, 0) : 0;
    const currentRunRate = innings?.balls_bowled ? (innings.total_runs / innings.balls_bowled) * 6 : 0;
    const requiredRunRate = innings?.target && ballsRemaining ? (runsNeeded / ballsRemaining) * 6 : 0;
    const battingWinChance = (() => {
        if (!innings || innings.innings_number < 2 || !innings.target)
            return 50;
        if (runsNeeded === 0)
            return 100;
        if (ballsRemaining === 0 || innings.total_wickets >= 10)
            return 0;
        const wicketsRemaining = 10 - innings.total_wickets;
        return Math.round(Math.min(95, Math.max(5, 50 + (currentRunRate - requiredRunRate) * 5 + (wicketsRemaining - 5) * 2)));
    })();
    const teamAWinChance = match?.status === "completed"
        ? winningTeamId === match.team_a_id ? 100 : winningTeamId === match.team_b_id ? 0 : 50
        : innings?.batting_team_id === match?.team_a_id ? battingWinChance : 100 - battingWinChance;
    const teamBWinChance = 100 - teamAWinChance;
    const requiresSetup = !innings?.striker_id || !innings?.non_striker_id || !innings?.current_bowler_id;
    useEffect(() => {
        if (!winningTeamId) {
            setShowCelebration(false);
            return;
        }
        setShowCelebration(true);
        const timeout = window.setTimeout(() => setShowCelebration(false), 120000);
        return () => window.clearTimeout(timeout);
    }, [winningTeamId]);
    useEffect(() => {
        if (!boundaryPop)
            return;
        const timeout = window.setTimeout(() => setBoundaryPop(null), 900);
        return () => window.clearTimeout(timeout);
    }, [boundaryPop]);
    useEffect(() => {
        if (!wicketPop)
            return;
        const timeout = window.setTimeout(() => setWicketPop(null), 1050);
        return () => window.clearTimeout(timeout);
    }, [wicketPop]);
    const batterStats = (playerId: string | null) => {
        if (!playerId)
            return { runs: 0, balls: 0 };
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
    const dismissedPlayerIds = new Set(balls.filter((ball) => ball.is_wicket && ball.player_out_id).map((ball) => ball.player_out_id));
    const eligibleNewBatters = innings ? candidates(innings.batting_team_id).filter((player) => player.id !== innings.striker_id && player.id !== innings.non_striker_id && !dismissedPlayerIds.has(player.id)) : [];
    const battingSideSize = innings ? candidates(innings.batting_team_id).length : 0;
    const isLastWicket = Boolean(innings && innings.total_wickets + 1 >= Math.max(battingSideSize - 1, 1));
    const freeHitActive = (() => {
        for (let index = balls.length - 1; index >= 0; index--) {
            if (balls[index].extras_type === "no_ball")
                return true;
            if (balls[index].is_legal)
                return false;
        }
        return false;
    })();
    const saveInnings = async (next: Partial<Innings>) => {
        if (!innings)
            return;
        const { error } = await (supabase.from("innings") as any).update(next).eq("id", innings.id);
        if (error)
            throw error;
        setInnings({ ...innings, ...next });
    };
    const assignPlayerOfMatch = async (winnerTeamId?: string | null) => {
        if (!match)
            return null;
        const { data: inningsRows, error: inningsError } = await (supabase.from("innings") as any).select("id").eq("match_id", match.id);
        if (inningsError || !inningsRows?.length)
            return null;
        const { data: matchBalls, error: ballsError } = await (supabase.from("ball_by_ball") as any).select("batsman_id,bowler_id,runs,is_wicket,dismissal_type").in("innings_id", inningsRows.map((row: {
            id: string;
        }) => row.id));
        if (ballsError || !matchBalls?.length)
            return null;
        const stats = new Map<string, {
            runs: number;
            wickets: number;
        }>();
        const add = (playerId: string | null, field: "runs" | "wickets", amount: number) => {
            if (!playerId)
                return;
            const current = stats.get(playerId) || { runs: 0, wickets: 0 };
            current[field] += amount;
            stats.set(playerId, current);
        };
        matchBalls.forEach((ball: {
            batsman_id: string | null;
            bowler_id: string | null;
            runs: number;
            is_wicket: boolean;
            dismissal_type: string | null;
        }) => {
            add(ball.batsman_id, "runs", ball.runs || 0);
            if (ball.is_wicket && ball.dismissal_type !== "run_out")
                add(ball.bowler_id, "wickets", 1);
        });
        const ranked = [...stats.entries()].map(([playerId, stat]) => ({
            playerId,
            stat,
            teamId: players.find((player) => player.id === playerId)?.team_id || null,
            impact: stat.runs + stat.wickets * 28 + (stat.runs >= 50 ? 12 : 0) + (stat.wickets >= 3 ? 12 : 0),
        })).sort((a, b) => b.impact - a.impact || b.stat.wickets - a.stat.wickets || b.stat.runs - a.stat.runs);
        const winnerCandidates = winnerTeamId ? ranked.filter((candidate) => candidate.teamId === winnerTeamId) : ranked;
        const winner = winnerCandidates[0] || ranked[0];
        if (!winner)
            return null;
        const { playerId, stat } = winner;
        const parts = [stat.runs ? `${stat.runs} run${stat.runs === 1 ? "" : "s"}` : "", stat.wickets ? `${stat.wickets} wicket${stat.wickets === 1 ? "" : "s"}` : ""].filter(Boolean);
        return { playerId, summary: parts.join(", ") || "Match contribution" };
    };
    const startInnings = async () => {
        if (!match || setup.striker === setup.nonStriker || !setup.striker || !setup.nonStriker || !setup.bowler)
            return alert("Choose two different batters and one bowler.");
        setSaving(true);
        try {
            const battingTeam = innings?.innings_number === 2 ? innings.batting_team_id : setup.battingTeam;
            const bowling = innings?.innings_number === 2 ? innings.bowling_team_id : (battingTeam === match.team_a_id ? match.team_b_id : match.team_a_id);
            const payload = { match_id: match.id, innings_number: innings?.innings_number || 1, batting_team_id: battingTeam, bowling_team_id: bowling, striker_id: setup.striker, non_striker_id: setup.nonStriker, current_bowler_id: setup.bowler };
            const result = innings ? await (supabase.from("innings") as any).update(payload).eq("id", innings.id).select("*").single() : await (supabase.from("innings") as any).insert(payload).select("*").single();
            if (result.error)
                throw result.error;
            setInnings(result.data);
            setSetupOpen(false);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to start innings.");
        }
        finally {
            setSaving(false);
        }
    };
    const record = async ({ runs = 0, extras = 0, extrasType, legal = true, wicket = false, dismissalType, outId, fielderId }: {
        runs?: number;
        extras?: number;
        extrasType?: string;
        legal?: boolean;
        wicket?: boolean;
        dismissalType?: string;
        outId?: string;
        fielderId?: string;
    }) => {
        if (!innings || !match || saving || completed || innings.is_completed || requiresSetup)
            return;
        setRedoSnapshot(null);
        if (runs === 4 || runs === 6)
            setBoundaryPop({ runs, key: Date.now() });
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
            const generatedCommentary = generateCommentary({
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
            const commentary = `${generatedCommentary} [zone:${shotZone}]`;
            let striker = innings.striker_id!;
            let nonStriker = innings.non_striker_id!;
            if (runs % 2 === 1 || (extrasType === "bye" || extrasType === "leg_bye") && extras % 2 === 1)
                [striker, nonStriker] = [nonStriker, striker];
            if (isOverEnd)
                [striker, nonStriker] = [nonStriker, striker];
            if (wicket && outId === striker)
                striker = nextBatter || "";
            if (wicket && outId === nonStriker)
                nonStriker = nextBatter || "";
            const next = { total_runs: nextTotalRuns, total_wickets: nextTotalWickets, balls_bowled: nextBallsBowled, extras: (innings.extras || 0) + extras, overs_completed: Number(`${Math.floor(nextBallsBowled / 6)}.${nextBallsBowled % 6}`), is_completed: inningsComplete, striker_id: striker || null, non_striker_id: nonStriker || null };
            const ballPayload = { client_event_id: crypto.randomUUID(), innings_id: innings.id, over_number: Math.floor(innings.balls_bowled / 6) + 1, ball_number: innings.balls_bowled % 6 + 1, batsman_id: innings.striker_id, non_striker_id: innings.non_striker_id, bowler_id: innings.current_bowler_id, runs, extras, extras_type: extrasType || null, is_legal: legal, is_wicket: wicket, dismissal_type: dismissalType || null, player_out_id: outId || null, fielder_id: fielderId || null, commentary };
            const { data: ball, error: ballError } = await (supabase.from("ball_by_ball") as any).insert(ballPayload).select("*").single();
            if (ballError) {
                await saveToOfflineQueue(match.id, { ball: ballPayload, inningsId: innings.id, next });
                const queuedBall = { id: `offline-${Date.now()}`, ...ballPayload } as Ball;
                setInnings({ ...innings, ...next });
                setBalls([...balls, queuedBall]);
                setOfflinePending((count) => count + 1);
                speakCommentary(generatedCommentary);
                alert("Connection unavailable. Ball saved safely on this device and will sync automatically when online.");
                return;
            }
            await saveInnings(next);
            setBalls([...balls, ball]);
            speakCommentary(generatedCommentary);
            if (match.status === "scheduled") {
                const { error } = await (supabase.from("matches") as any).update({ status: "live" }).eq("id", match.id);
                if (error)
                    throw error;
                setMatch({ ...match, status: "live" });
            }
            if (inningsComplete && innings.innings_number === 1) {
                const { data: secondInnings, error: secondInningsError } = await (supabase.from("innings") as any).insert({ match_id: match.id, innings_number: 2, batting_team_id: innings.bowling_team_id, bowling_team_id: innings.batting_team_id, target: nextTotalRuns + 1 }).select("*").single();
                if (secondInningsError)
                    throw secondInningsError;
                setInnings(secondInnings);
                setBalls([]);
                setSetup({ battingTeam: secondInnings.batting_team_id, striker: "", nonStriker: "", bowler: "" });
                setSetupOpen(true);
            }
            if (inningsComplete && innings.innings_number === 2) {
                const winnerId = targetReached ? innings.batting_team_id : nextTotalRuns === (innings.target || 1) - 1 ? null : innings.bowling_team_id;
                const playerOfMatch = await assignPlayerOfMatch(winnerId);
                const { error: finishError } = await (supabase.from("matches") as any).update({ status: "completed", winner_id: winnerId, player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }).eq("id", match.id);
                if (finishError)
                    throw finishError;
                setMatch({ ...match, status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null });
            }
            if (isOverEnd) {
                setNewBowler("");
                setNextBowlerOpen(true);
            }
            setWicketOpen(false);
            setNextBatter("");
            setFielder("");
        }
        catch (error) {
            console.error("Scoring save failed", error);
            alert(error instanceof Error ? error.message : "Ball was not saved.");
        }
        finally {
            setSaving(false);
        }
    };
    const saveBowler = async () => {
        if (!innings || !newBowler)
            return;
        if (newBowler === innings.current_bowler_id)
            return alert("The same bowler cannot bowl consecutive overs.");
        if (legalBallsByBowler(newBowler) >= maxOversPerBowler * 6)
            return alert(`This bowler has completed the maximum ${maxOversPerBowler} overs.`);
        setSaving(true);
        try {
            await saveInnings({ current_bowler_id: newBowler });
            setNextBowlerOpen(false);
        }
        catch {
            alert("Unable to update bowler.");
        }
        finally {
            setSaving(false);
        }
    };
    const openNewBatter = () => {
        setNewBatter("");
        setBatterSlot("striker_id");
        setNewBatterOpen(true);
    };
    const saveNewBatter = async () => {
        if (!innings || !newBatter || !eligibleNewBatters.some((player) => player.id === newBatter))
            return alert("Select an available batter.");
        setSaving(true);
        try {
            await saveInnings({ [batterSlot]: newBatter });
            setNewBatterOpen(false);
        }
        catch {
            alert("Unable to update batter.");
        }
        finally {
            setSaving(false);
        }
    };
    const saveToss = async () => {
        if (!match || !tossWinner)
            return;
        setSaving(true);
        try {
            const { error } = await (supabase.from("matches") as any).update({ toss_winner_id: tossWinner, toss_decision: tossDecision }).eq("id", match.id);
            if (error)
                throw error;
            const battingTeam = tossDecision === "bat" ? tossWinner : (tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id);
            setMatch({ ...match, toss_winner_id: tossWinner, toss_decision: tossDecision });
            if (!innings)
                setSetup({ battingTeam, striker: "", nonStriker: "", bowler: "" });
            setTossOpen(false);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to save toss.");
        }
        finally {
            setSaving(false);
        }
    };
    const finish = async () => { if (!match || !confirm("Finish match and lock scoring?"))
        return; const playerOfMatch = await assignPlayerOfMatch(winningTeamId); const { error } = await (supabase.from("matches") as any).update({ status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }).eq("id", match.id); if (error)
        return alert("Unable to finish match."); setMatch({ ...match, status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }); };
    const handoverScoring = async () => {
        const url = window.location.href;
        await navigator.clipboard.writeText(url);
        const snapshot = JSON.stringify({ matchId: id, exportedAt: new Date().toISOString(), innings, balls }, null, 2);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([snapshot], { type: "application/json" }));
        link.download = `crickpulse-handover-${id}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        alert("Secure scorer link copied and a recovery snapshot downloaded. The next authorized scorer can open the link and continue from the live database state.");
    };
    const undoLastBall = async () => {
        const lastBall = balls[balls.length - 1];
        if (!innings || !lastBall || saving || completed)
            return;
        if (!confirm("Undo the latest ball? This will restore the score before that ball."))
            return;
        setSaving(true);
        try {
            const remaining = balls.slice(0, -1);
            const totalRuns = remaining.reduce((total, ball) => total + ball.runs + ball.extras, 0);
            const totalExtras = remaining.reduce((total, ball) => total + ball.extras, 0);
            const wickets = remaining.filter((ball) => ball.is_wicket).length;
            const legalBalls = remaining.filter((ball) => ball.is_legal).length;
            const { error: deleteError } = await (supabase.from("ball_by_ball") as any).delete().eq("id", lastBall.id);
            if (deleteError)
                throw deleteError;
            const restored = { total_runs: totalRuns, total_wickets: wickets, extras: totalExtras, balls_bowled: legalBalls, overs_completed: Number(`${Math.floor(legalBalls / 6)}.${legalBalls % 6}`), is_completed: false, striker_id: lastBall.batsman_id, non_striker_id: lastBall.non_striker_id, current_bowler_id: lastBall.bowler_id };
            const { error: restoreError } = await (supabase.from("innings") as any).update(restored).eq("id", innings.id);
            if (restoreError)
                throw restoreError;
            setInnings({ ...innings, ...restored });
            setBalls(remaining);
            setRedoSnapshot({ ball: lastBall, innings });
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to undo the latest ball.");
        }
        finally {
            setSaving(false);
        }
    };
    const redoLastBall = async () => {
        if (!redoSnapshot || !innings || saving || completed)
            return;
        setSaving(true);
        try {
            const { ball, innings: restoredInnings } = redoSnapshot;
            const { error: insertError } = await (supabase.from("ball_by_ball") as any).insert(ball);
            if (insertError)
                throw insertError;
            const { error: inningsError } = await (supabase.from("innings") as any)
                .update(restoredInnings)
                .eq("id", restoredInnings.id);
            if (inningsError)
                throw inningsError;
            setBalls([...balls, ball]);
            setInnings(restoredInnings);
            setRedoSnapshot(null);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to redo the latest ball.");
        }
        finally {
            setSaving(false);
        }
    };
    const openWicket = (type: string) => { setWicketType(type); setWicketPop({ type, key: Date.now() }); setPlayerOut(innings?.striker_id || ""); setNextBatter(""); setFielder(""); setWicketOpen(true); };
    const saveWicket = () => {
        if (freeHitActive && wicketType !== "run_out")
            return alert("Free Hit: only a run out dismissal is allowed.");
        if (!isLastWicket && !nextBatter)
            return alert("Select the next batter.");
        if (["caught", "run_out", "stumped"].includes(wicketType) && !fielder)
            return alert("Select the fielder involved.");
        record({ wicket: true, dismissalType: wicketType, outId: playerOut, fielderId: fielder || undefined });
    };
    const openAdvancedDelivery = () => {
        setAdvancedRuns(0);
        setAdvancedExtras(1);
        setAdvancedExtrasType("wide");
        setAdvancedDeliveryOpen(true);
    };
    const saveAdvancedDelivery = () => {
        const isPenaltyExtra = advancedExtrasType === "wide" || advancedExtrasType === "no_ball";
        if (advancedExtras < 1)
            return alert("Extras must be at least 1.");
        record({
            runs: advancedRuns,
            extras: advancedExtras,
            extrasType: advancedExtrasType,
            legal: !isPenaltyExtra,
        });
        setAdvancedDeliveryOpen(false);
    };
    const startVoiceScoring = () => {
        const SpeechRecognition = (window as Window & {
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
            SpeechRecognition?: new () => SpeechRecognitionLike;
        }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
        if (!SpeechRecognition)
            return alert("Voice scoring is not supported in this browser. Use Chrome or Edge.");
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onresult = (event) => {
            const command = event.results[0]?.[0]?.transcript?.toLowerCase().trim() || "";
            setVoiceMessage(`Heard: ${command}`);
            const runWords: Record<string, number> = { zero: 0, dot: 0, one: 1, single: 1, two: 2, double: 2, three: 3, four: 4, boundary: 4, six: 6 };
            const runCommand = Object.entries(runWords).find(([word]) => command === word || command.includes(`${word} run`) || command.includes(`${word} runs`));
            if (command.includes("no ball"))
                void record({ extras: 1, extrasType: "no_ball", legal: false });
            else if (command.includes("leg bye"))
                void record({ extras: 1, extrasType: "leg_bye", legal: true });
            else if (command.includes("wide"))
                void record({ extras: 1, extrasType: "wide", legal: false });
            else if (command.includes("bye"))
                void record({ extras: 1, extrasType: "bye", legal: true });
            else if (command.includes("undo"))
                void undoLastBall();
            else if (command.includes("redo"))
                void redoLastBall();
            else if (command.includes("wicket"))
                openWicket(freeHitActive ? "run_out" : "bowled");
            else if (runCommand)
                void record({ runs: runCommand[1] });
            else
                setVoiceMessage(`Not recognised: ${command}. Try “four”, “wide”, “wicket” or “undo”.`);
        };
        recognition.onerror = () => {
            setVoiceListening(false);
            setVoiceMessage("Voice command was not captured. Please try again.");
        };
        recognition.onend = () => setVoiceListening(false);
        setVoiceMessage("Listening… say a score command.");
        setVoiceListening(true);
        recognition.start();
    };
    if (loading)
        return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary"/></div>;
    if (accessDenied)
        return <div className="mx-auto max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-amber-950"><LockKeyhole className="mx-auto h-10 w-10 text-amber-600"/><h1 className="mt-3 text-xl font-black">Scoring access locked</h1><p className="mt-2 text-sm">This match is locked to its assigned Tournament Organizer. Ask the Master Admin or tournament owner to change the scorer assignment.</p><Link href="/admin/matches" className="mt-5 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white">Back to matches</Link></div>;
    if (!match)
        return <div className="p-8 text-center text-red-600">Match not found.</div>;
    return <div className="live-score-shell max-w-5xl mx-auto space-y-4 pb-12">
    {offlinePending > 0 && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-900">Offline safety queue: {offlinePending} ball{offlinePending === 1 ? "" : "s"} waiting to sync. Keep this device open; sync runs automatically when the connection returns.</div>}
    <header className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/admin/matches" className="p-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link><div><h1 className="font-bold text-xl">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)}</h1><p className="text-sm text-muted-foreground">{completed ? "Match completed" : saving ? "Saving ball…" : "Live scoring"}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={() => setTossOpen(true)} disabled={completed || saving} className="control">Toss</button><button onClick={() => setSetupOpen(true)} className="control"><Settings2 className="w-4 h-4 mr-1"/>Setup</button><button onClick={finish} disabled={completed || saving} className="control bg-primary text-primary-foreground"><CheckCircle2 className="w-4 h-4 mr-1"/>Finish</button>{completed && innings?.innings_number === 2 && innings.target ? <p className="w-full text-right text-xs font-bold uppercase tracking-wide text-foreground">{innings.total_runs >= innings.target ? `${teamName(innings.batting_team_id)} win by ${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0)} wicket${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0) === 1 ? "" : "s"}.` : innings.total_runs === innings.target - 1 ? "Match tied." : `${teamName(innings.bowling_team_id)} win by ${innings.target - 1 - innings.total_runs} run${innings.target - 1 - innings.total_runs === 1 ? "" : "s"}.`}</p> : match.toss_winner_id && match.toss_decision && <p className="w-full text-right text-xs uppercase tracking-wide text-muted-foreground"><strong className="text-foreground">{teamName(match.toss_winner_id)}</strong> have won the toss and have opted to <strong className="text-foreground">{match.toss_decision === "bat" ? "bat" : "bowl"}</strong>.</p>}</div></header>
    <section className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-card p-3" aria-label="Voice tools"><label className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><span>Commentary voice</span><select value={commentaryVoice} onChange={(event) => changeCommentaryVoice(event.target.value)} className="input min-h-10 w-auto py-1 text-xs"><option value="en-IN">English — India</option><option value="en-GB">English — UK</option><option value="en-US">English — US</option></select></label><button type="button" onClick={toggleAutoCommentary} aria-pressed={autoCommentary} className={`control ${autoCommentary ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : ""}`}>{autoCommentary ? <Volume2 className="mr-1.5 h-4 w-4"/> : <VolumeX className="mr-1.5 h-4 w-4"/>}{autoCommentary ? "Auto Commentary On" : "Auto Commentary Off"}</button><button type="button" onClick={startVoiceScoring} disabled={voiceListening || saving || completed || requiresSetup} className="control"><span className="relative mr-1.5">{voiceListening ? <MicOff className="h-4 w-4 text-red-500"/> : <Mic className="h-4 w-4 text-primary"/>}</span>{voiceListening ? "Listening…" : "Voice Score"}</button><button type="button" onClick={() => void handoverScoring()} className="control"><Share2 className="mr-1 h-4 w-4"/>Scorer Handover</button><Link href={`/admin/matches/analytics/${id}`} className="control"><BarChart3 className="mr-1 h-4 w-4"/>Advanced Analytics</Link><Link href={`/admin/matches/scorecard/${id}`} className="control"><FileText className="w-4 h-4 mr-1"/>Scorecard & Match Summary</Link></section>
    {voiceMessage && <div role="status" className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">{voiceMessage}</div>}
    {requiresSetup && <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">Choose batting team, opening pair and bowler before recording a ball. <button onClick={() => setSetupOpen(true)} className="underline font-semibold">Open setup</button></div>}
    <section className="score-hero-animated text-white p-7 rounded-xl shadow-lg"><div className="flex justify-between text-sm opacity-80"><span>{innings ? `${teamName(innings.batting_team_id)} batting` : "Innings not started"}</span><span>Overs {overs} / {match.overs_per_match}.0</span></div>{freeHitActive && <div className="mx-auto mt-3 w-fit rounded-full border border-amber-200 bg-amber-400 px-4 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg">Free Hit</div>}<div className="grid grid-cols-[72px_1fr_72px] items-center gap-3 my-4"><div className="flex flex-col items-center justify-center gap-1.5">{teamA?.logo_url ? <img src={teamA.logo_url} alt={teamA.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_a_id).slice(0, 2)}</div>}<strong className="text-base leading-none text-white">{teamAWinChance}%</strong><span className="text-[0.62rem] font-bold uppercase leading-none text-cyan-100">Win</span></div><div className="relative text-center"><strong className="text-6xl">{score}</strong>{boundaryPop && <BoundaryPop key={boundaryPop.key} runs={boundaryPop.runs}/>}{showCelebration && winningTeam && <ScoreCelebration color={winningTeam.primary_color || "#facc15"} teamName={winningTeam.name}/>}<div className="mt-3 flex items-center justify-center gap-6 text-sm font-semibold"><p>CRR: <strong className="text-yellow-300">{currentRunRate.toFixed(2)}</strong></p>{innings?.innings_number === 2 && innings.target ? <p>RRR: <strong className="text-yellow-300">{runsNeeded === 0 ? "0.00" : ballsRemaining ? requiredRunRate.toFixed(2) : "—"}</strong></p> : null}{innings?.innings_number === 1 && <p>Proj. Score: <strong className="text-yellow-300">{innings.balls_bowled ? Math.round((innings.total_runs / innings.balls_bowled) * match.overs_per_match * 6) : 0}</strong></p>}</div></div><div className="flex flex-col items-center justify-center gap-1.5">{teamB?.logo_url ? <img src={teamB.logo_url} alt={teamB.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_b_id).slice(0, 2)}</div>}<strong className="text-base leading-none text-white">{teamBWinChance}%</strong><span className="text-[0.62rem] font-bold uppercase leading-none text-emerald-100">Win</span></div></div><div className="grid sm:grid-cols-3 gap-4 border-t border-white/20 pt-4 text-sm"><div className="flex items-center gap-3">{playerPhoto(innings?.striker_id || null) ? <img src={playerPhoto(innings?.striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-300"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">S</div>}<div><span className="opacity-70">Striker</span><p className="font-bold">{playerName(innings?.striker_id || null)} * <span className="text-yellow-300">{strikerStats.runs} ({strikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.non_striker_id || null) ? <img src={playerPhoto(innings?.non_striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/70"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">NS</div>}<div><span className="opacity-70">Non-striker</span><p className="font-bold">{playerName(innings?.non_striker_id || null)} <span className="text-yellow-300">{nonStrikerStats.runs} ({nonStrikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.current_bowler_id || null) ? <img src={playerPhoto(innings?.current_bowler_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-sky-300"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">B</div>}<div><span className="opacity-70">Bowler</span><p className="font-bold">{playerName(innings?.current_bowler_id || null)}</p></div></div></div></section>
    {winningTeam && <section className="overflow-hidden rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-950 shadow-sm"><div className="grid md:grid-cols-2"><div className="flex items-center gap-4 p-5">{winningTeam.logo_url ? <img src={winningTeam.logo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center font-black">WIN</div>}<div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Match won</p><p className="text-xl font-black">{winningTeam.name} WIN!</p><p className="text-sm font-semibold">A memorable victory by {(innings?.total_runs || 0) >= (innings?.target || Infinity) ? `${Math.max(candidates(innings?.batting_team_id || "").length - 1 - (innings?.total_wickets || 0), 0)} wickets` : `${(innings?.target || 1) - 1 - (innings?.total_runs || 0)} runs`}.</p></div></div>{match.player_of_match_id && <div className="flex items-center gap-3 border-t border-emerald-300/70 bg-white/45 p-5 md:border-l md:border-t-0">{playerOfMatch?.photo_url ? <img src={playerOfMatch.photo_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-400 ring-offset-2"/> : <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-black">POM</div>}<div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Player of the Match</p><p className="truncate text-lg font-black">{playerName(match.player_of_match_id)}</p><p className="text-sm font-semibold">{match.player_of_match_summary}</p></div></div>}</div></section>}
    {innings?.innings_number === 2 && innings.target && <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center"><div className="bg-card p-3"><p className="text-xs text-muted-foreground">TARGET</p><p className="font-bold text-lg">{innings.target}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">NEED</p><p className="font-bold text-lg">{Math.max(innings.target - innings.total_runs, 0)}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">BALLS LEFT</p><p className="font-bold text-lg">{Math.max(match.overs_per_match * 6 - innings.balls_bowled, 0)}</p></div></section>}
    <section className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Shot direction</h2><p className="text-xs text-muted-foreground">Select before recording runs for an accurate Wagon Wheel.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase text-primary">{shotZone.replace("_", " ")}</span></div><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{[["straight", "Straight"], ["cover", "Cover"], ["point", "Point"], ["square_leg", "Square Leg"], ["midwicket", "Midwicket"], ["fine_leg", "Fine Leg"]].map(([value, label]) => <button key={value} type="button" onClick={() => setShotZone(value)} className={`small-button min-h-11 ${shotZone === value ? "border-primary bg-primary text-primary-foreground" : ""}`}>{label}</button>)}</div></section>
    <div className="grid lg:grid-cols-2 gap-4"><div className="space-y-3"><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold mb-3">Runs</h2><div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 6].map((run) => <button key={run} onClick={() => record({ runs: run })} disabled={saving || completed || requiresSetup} className="score-button">{run}</button>)}</div></section><div className="grid grid-cols-2 gap-2"><button onClick={undoLastBall} disabled={!balls.length || saving || completed} className="control w-full justify-center"><RotateCcw className="mr-2 h-4 w-4"/>Undo</button><button onClick={redoLastBall} disabled={!redoSnapshot || saving || completed} className="control w-full justify-center"><RotateCw className="mr-2 h-4 w-4"/>Redo</button></div><section className="grid grid-cols-2 gap-3" aria-label="Quick player changes"><button type="button" onClick={openNewBatter} disabled={!innings || saving || completed} className="control min-h-16 justify-center rounded-xl border-primary/30 bg-card text-base shadow-sm hover:border-primary"><UserPlus className="mr-2 h-5 w-5 text-primary"/>New Batter</button><button type="button" onClick={() => { setNewBowler(""); setNextBowlerOpen(true); }} disabled={!innings || saving || completed} className="control min-h-16 justify-center rounded-xl border-primary/30 bg-card text-base shadow-sm hover:border-primary"><ArrowRightLeft className="mr-2 h-5 w-5 text-primary"/>Swap Bowler</button></section></div><div className="space-y-4"><section className="bg-card border border-border rounded-xl p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">Extras</h2><button type="button" onClick={openAdvancedDelivery} disabled={saving || completed || requiresSetup} className="control min-h-10 px-3 text-xs"><SlidersHorizontal className="mr-1.5 h-4 w-4"/>Advanced</button></div><div className="grid grid-cols-4 gap-2">{[["Wd", "wide", false], ["NB", "no_ball", false], ["B", "bye", true], ["LB", "leg_bye", true]].map(([label, type, legal]) => <button key={String(type)} onClick={() => record({ extras: 1, extrasType: String(type), legal: Boolean(legal) })} disabled={saving || completed || requiresSetup} className="small-button">{label}</button>)}</div></section><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold text-red-600 mb-3">Wicket</h2>{freeHitActive && <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">Free Hit active — only Run Out is available.</p>}<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[["bowled", "Bowled"], ["caught", "Caught"], ["lbw", "LBW"], ["stumped", "Stumping"], ["run_out", "Run Out"], ["hit_wicket", "Hit Wicket"], ["obstructing_field", "Obstructing"], ["timed_out", "Timed Out"]].map(([type, label]) => <button key={type} onClick={() => openWicket(type)} disabled={saving || completed || requiresSetup || (freeHitActive && type !== "run_out")} className="small-button text-red-600 disabled:text-muted-foreground">{label}</button>)}</div></section></div></div>
    <section className="bg-card border border-border rounded-xl overflow-hidden"><div className="grid grid-cols-[90px_1fr_86px] bg-primary border-b border-primary px-4 py-2 text-sm font-bold text-primary-foreground"><span>Overs</span><span>Balls</span><span className="text-right text-primary-foreground">Runs</span></div>{currentOverBalls.length ? <div className="grid grid-cols-[90px_1fr_86px] min-h-20"><div className="border-r border-border px-4 py-4"><p className="font-medium">Ov {currentOverNumber}</p><p className="mt-2 text-sm text-muted-foreground">{innings ? `${innings.total_runs}-${innings.total_wickets}` : "0-0"}</p></div><div className="px-4 py-4 min-w-0"><p className="text-sm text-muted-foreground truncate">{playerName(currentOverBowler)} to {playerName(currentOverBatter)}</p><div className="flex flex-wrap gap-2 mt-2">{currentOverBalls.map((ball) => <span key={ball.id} title={`${ball.over_number}.${ball.ball_number}`} className={`inline-flex h-6 min-w-6 px-1 items-center justify-center rounded text-xs font-bold ${ball.is_wicket ? "bg-red-600 text-white" : ball.extras_type ? "bg-amber-500 text-white" : ball.runs === 4 || ball.runs === 6 ? "bg-sky-600 text-white" : "bg-muted text-foreground"}`}>{ball.is_wicket ? "W" : ball.extras_type === "wide" ? "Wd" : ball.extras_type === "no_ball" ? "NB" : ball.runs + ball.extras}</span>)}</div></div><div className="border-l border-border px-4 py-4 flex items-center justify-end font-bold">{currentOverRuns}</div></div> : <div className="px-4 py-5 text-sm text-muted-foreground">No balls recorded in this over.</div>}</section>
    {wicketPop && <WicketPop key={wicketPop.key} type={wicketPop.type}/>}
    <LiveCommentary key={`${innings?.id || "new"}:${balls.length}`} inningsId={innings?.id || null}/>
    <nav aria-label="Mobile quick scoring" className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-7 gap-1 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur lg:hidden">{[0, 1, 2, 4, 6].map((run) => <button key={run} type="button" onClick={() => record({ runs: run })} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl bg-primary text-base font-black text-primary-foreground disabled:opacity-40">{run}</button>)}<button type="button" onClick={openAdvancedDelivery} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl border border-amber-400 bg-amber-50 text-[0.65rem] font-black text-amber-950 disabled:opacity-40">EXTRA</button><button type="button" onClick={() => openWicket(freeHitActive ? "run_out" : "bowled")} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl bg-red-600 text-[0.7rem] font-black text-white disabled:opacity-40">WICKET</button></nav>
    {setupOpen && <Modal title={innings?.innings_number === 2 ? "Second innings setup" : "Start / correct innings"} onClose={() => setSetupOpen(false)}><Select label="Batting team" value={setup.battingTeam} onChange={(value) => setSetup({ battingTeam: value, striker: "", nonStriker: "", bowler: "" })} options={teams.map((team) => [team.id, team.name])}/><Select label="Striker" value={setup.striker} onChange={(value) => setSetup({ ...setup, striker: value })} options={battingPlayers.map((player) => [player.id, player.name])}/><Select label="Non-striker" value={setup.nonStriker} onChange={(value) => setSetup({ ...setup, nonStriker: value })} options={battingPlayers.filter((player) => player.id !== setup.striker).map((player) => [player.id, player.name])}/><Select label="First / current bowler" value={setup.bowler} onChange={(value) => setSetup({ ...setup, bowler: value })} options={bowlingPlayers.map((player) => [player.id, player.name])}/><ModalActions onCancel={() => setSetupOpen(false)} onSave={startInnings} saving={saving} label={innings?.innings_number === 2 ? "Start chase" : "Start scoring"}/></Modal>}
    {tossOpen && <Modal title="Match Toss" onClose={() => setTossOpen(false)}><Select label="Toss winner" value={tossWinner} onChange={setTossWinner} options={teams.map((team) => [team.id, team.name])}/><Select label="Decision" value={tossDecision} onChange={setTossDecision} options={[["bat", "Bat"], ["bowl", "Bowl"]]}/><ModalActions onCancel={() => setTossOpen(false)} onSave={saveToss} saving={saving} label="Save toss"/></Modal>}
    {nextBowlerOpen && <Modal title="Over complete — choose next bowler" onClose={() => setNextBowlerOpen(false)}><p className="mb-3 text-sm text-muted-foreground">Select a different bowler. Maximum {maxOversPerBowler} overs per bowler in this match.</p><Select label="Next bowler" value={newBowler} onChange={setNewBowler} options={eligibleNextBowlers.map((player) => [player.id, `${player.name} (${Math.floor(legalBallsByBowler(player.id) / 6)}.${legalBallsByBowler(player.id) % 6} ov)`])}/><ModalActions onCancel={() => setNextBowlerOpen(false)} onSave={saveBowler} saving={saving} label="Confirm bowler"/></Modal>}
    {wicketOpen && <Modal title={`Wicket — ${wicketType.replaceAll("_", " ")}`} onClose={() => setWicketOpen(false)}><div className="rounded-md bg-muted p-3 text-sm"><span className="text-muted-foreground">Current bowler (auto): </span><strong>{playerName(innings?.current_bowler_id || null)}</strong></div><Select label="Player out" value={playerOut} onChange={setPlayerOut} options={[[innings?.striker_id || "", `${playerName(innings?.striker_id || null)} (striker)`], [innings?.non_striker_id || "", `${playerName(innings?.non_striker_id || null)} (non-striker)`]]}/>{["caught", "run_out", "stumped"].includes(wicketType) && <Select label={wicketType === "run_out" ? "Run out completed by" : "Fielder"} value={fielder} onChange={setFielder} options={candidates(innings?.bowling_team_id || "").map((player) => [player.id, player.name])}/>} {!isLastWicket ? <Select label="Next batter" value={nextBatter} onChange={setNextBatter} options={eligibleNewBatters.map((player) => [player.id, player.name])}/> : <p className="rounded-md bg-red-50 p-3 text-sm font-bold text-red-800">Final wicket — innings will close automatically.</p>}<ModalActions onCancel={() => setWicketOpen(false)} onSave={saveWicket} saving={saving} label="Save wicket"/></Modal>}
    {advancedDeliveryOpen && <Modal title="Advanced delivery" onClose={() => setAdvancedDeliveryOpen(false)}><Select label="Extras type" value={advancedExtrasType} onChange={(value) => { setAdvancedExtrasType(value); if (value !== "no_ball") setAdvancedRuns(0); }} options={[["wide", "Wide"], ["no_ball", "No ball"], ["bye", "Bye"], ["leg_bye", "Leg bye"]]}/><NumberChoice label="Runs off the bat (no-ball only)" value={advancedRuns} values={[0, 1, 2, 3, 4, 5, 6]} onChange={setAdvancedRuns} disabled={advancedExtrasType !== "no_ball"}/><NumberChoice label="Extra runs" value={advancedExtras} values={[1, 2, 3, 4, 5]} onChange={setAdvancedExtras}/><p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Total added: <strong className="text-foreground">{advancedRuns + advancedExtras}</strong>. Wide and no-ball do not count as legal deliveries.</p><ModalActions onCancel={() => setAdvancedDeliveryOpen(false)} onSave={saveAdvancedDelivery} saving={saving} label="Record delivery"/></Modal>}
    {newBatterOpen && <Modal title="Choose new batter" onClose={() => setNewBatterOpen(false)}><p className="text-sm text-muted-foreground">Select which batting position to replace, then choose an available player from the batting team.</p><Select label="Batting position" value={batterSlot} onChange={(value) => setBatterSlot(value as "striker_id" | "non_striker_id")} options={[["striker_id", `Striker - ${playerName(innings?.striker_id || null)}`], ["non_striker_id", `Non-striker - ${playerName(innings?.non_striker_id || null)}`]]}/><Select label="New batter" value={newBatter} onChange={setNewBatter} options={eligibleNewBatters.map((player) => [player.id, player.name])}/>{!eligibleNewBatters.length && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No available batters remain.</p>}<ModalActions onCancel={() => setNewBatterOpen(false)} onSave={saveNewBatter} saving={saving} label="Confirm batter"/></Modal>}
  </div>;
}
function Modal({ title, children, onClose }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) { return <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><div className="bg-card rounded-xl p-6 w-full max-w-md space-y-4"><h2 className="text-xl font-bold">{title}</h2>{children}<button onClick={onClose} className="text-sm text-muted-foreground">Close</button></div></div>; }
function Select({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[][];
}) { return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2"><option value="">Select…</option>{options.filter(([value]) => value).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>; }
function NumberChoice({ label, value, values, onChange, disabled = false }: {
    label: string;
    value: number;
    values: number[];
    onChange: (value: number) => void;
    disabled?: boolean;
}) {
    return <fieldset disabled={disabled} className="space-y-2 disabled:opacity-45"><legend className="text-sm font-medium">{label}</legend><div className="grid grid-cols-7 gap-1.5">{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-10 rounded-lg border text-sm font-black ${value === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>{item}</button>)}</div></fieldset>;
}
function ModalActions({ onCancel, onSave, saving, label }: {
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
    label: string;
}) { return <div className="flex justify-end gap-2 pt-2"><button onClick={onCancel} className="control">Cancel</button><button onClick={onSave} disabled={saving} className="control bg-primary text-primary-foreground">{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin"/>}{label}</button></div>; }
function ScoreCelebration({ color, teamName }: {
    color: string;
    teamName: string;
}) { return <div aria-hidden="true" className="score-celebration" style={{ "--celebration-color": color } as React.CSSProperties}><span className="score-ribbon score-ribbon-one"/><span className="score-ribbon score-ribbon-two"/><span className="score-ribbon score-ribbon-three"/><span className="score-ribbon score-ribbon-four"/><span className="score-ribbon score-ribbon-five"/><span className="score-win-message">{teamName} WIN!</span></div>; }
function BoundaryPop({ runs }: {
    runs: 4 | 6;
}) {
    return <span aria-hidden="true" className={`boundary-pop boundary-pop-${runs}`}>{runs === 4 ? "FOUR!" : "SIX!"}</span>;
}
function WicketPop({ type }: {
    type: string;
}) {
    const label = type.replace("_", " ").toUpperCase();
    return <div aria-hidden="true" className={`wicket-pop wicket-pop-${type}`}><span>WICKET!</span><strong>{label}</strong></div>;
}
