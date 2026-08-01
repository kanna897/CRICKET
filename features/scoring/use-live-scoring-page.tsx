"use client";
import Image from "next/image";
import React, { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, BarChart3, CheckCircle2, ChevronDown, FileText, Loader2, LockKeyhole, Mic, MicOff, RotateCcw, RotateCw, Settings2, Share2, SlidersHorizontal, UserPlus, Volume2, VolumeX } from "lucide-react";
import { scoringApi } from "@/features/scoring/api";
import { generateCommentary } from "@/lib/commentary";
import { getWicketLimit, isBowlerCreditedWicket, isHatTrick, runsChargedToBowler, shouldActivateLastMan } from "@/lib/cricket-rules";
import { LiveCommentary } from "@/components/live-commentary";
import { getOfflineQueue, removeOfflineQueueItem, saveToOfflineQueue, type OfflineQueueItem } from "@/lib/offlineSync";
import { useAdminAccess } from "@/components/admin-shell";
import { localePath } from "@/lib/locale-path";
import type { Json } from "@/types/database.types";
import type { Ball, Innings, Match, Player, Setup, SpeechRecognitionLike, Team } from "@/features/scoring/types";
import { deliveryBadgeLabel } from "@/features/scoring/utils";
import { BoundaryPop, HatTrickPop, ModalActions, NumberChoice, ScoreCelebration, ScoringModal as Modal, ScoringSelect as Select, WicketPop } from "@/features/scoring/components";
import { useReducerState } from "@/features/scoring/state";
import { useCommentaryVoice } from "@/features/scoring/use-commentary-voice";
import { rankPlayerOfMatch } from "@/features/scoring/actions";
import { syncIplPlayoffMatches } from "@/lib/ipl-playoffs-client";
import { supabase } from "@/lib/supabase";

export function useLiveScoringPage() {
    const { userId, isMasterAdmin } = useAdminAccess();
    const { id, locale } = useParams<{
        id: string;
        locale: string;
    }>();
    const [match, setMatch] = useReducerState<Match | null>(null);
    const [teams, setTeams] = useReducerState<Team[]>([]);
    const [players, setPlayers] = useReducerState<Player[]>([]);
    const [squadPlayerIds, setSquadPlayerIds] = useReducerState<string[]>([]);
    const [innings, setInnings] = useReducerState<Innings | null>(null);
    const [balls, setBalls] = useReducerState<Ball[]>([]);
    const [loading, setLoading] = useReducerState(true);
    const [accessDenied, setAccessDenied] = useReducerState(false);
    const [saving, setSaving] = useReducerState(false);
    const [setupOpen, setSetupOpen] = useReducerState(false);
    const [tossOpen, setTossOpen] = useReducerState(false);
    const [interruptionOpen, setInterruptionOpen] = useReducerState(false);
    const [nextBowlerOpen, setNextBowlerOpen] = useReducerState(false);
    const [newBatterOpen, setNewBatterOpen] = useReducerState(false);
    const [wicketOpen, setWicketOpen] = useReducerState(false);
    const [advancedDeliveryOpen, setAdvancedDeliveryOpen] = useReducerState(false);
    const [advancedRuns, setAdvancedRuns] = useReducerState(0);
    const [advancedExtras, setAdvancedExtras] = useReducerState(1);
    const [advancedExtrasType, setAdvancedExtrasType] = useReducerState("wide");
    const [setup, setSetup] = useReducerState<Setup>({ battingTeam: "", striker: "", nonStriker: "", bowler: "" });
    const [newBowler, setNewBowler] = useReducerState("");
    const [newBatter, setNewBatter] = useReducerState("");
    const [batterSlot, setBatterSlot] = useReducerState<"striker_id" | "non_striker_id">("striker_id");
    const [wicketType, setWicketType] = useReducerState("bowled");
    const [playerOut, setPlayerOut] = useReducerState("");
    const [nextBatter, setNextBatter] = useReducerState("");
    const [fielder, setFielder] = useReducerState("");
    const [showCelebration, setShowCelebration] = useReducerState(false);
    const [boundaryPop, setBoundaryPop] = useReducerState<{
        runs: 4 | 6;
        key: string;
    } | null>(null);
    const [wicketPop, setWicketPop] = useReducerState<{
        type: string;
        key: string;
    } | null>(null);
    const [hatTrickPop, setHatTrickPop] = useReducerState<{
        bowlerName: string;
        key: string;
    } | null>(null);
    const [tossWinner, setTossWinner] = useReducerState("");
    const [tossDecision, setTossDecision] = useReducerState("bat");
    const [revisedOvers, setRevisedOvers] = useReducerState("");
    const [revisedTarget, setRevisedTarget] = useReducerState("");
    const [targetMethod, setTargetMethod] = useReducerState<"manual" | "dls">("manual");
    const [interruptionNotes, setInterruptionNotes] = useReducerState("");
    const [pendingRuns, setPendingRuns] = useReducerState<number | null>(null);
    const [offlinePending, setOfflinePending] = useReducerState(0);
    const [redoSnapshot, setRedoSnapshot] = useReducerState<{ ball: Ball; innings: Innings } | null>(null);
    const [voiceListening, setVoiceListening] = useReducerState(false);
    const [voiceMessage, setVoiceMessage] = useReducerState("");
    const { autoCommentary, commentaryVoice, speakCommentary, toggleAutoCommentary, changeCommentaryVoice } = useCommentaryVoice();
    useEffect(() => {
        async function load() {
            const { data: matchData } = await scoringApi.getMatch(id);
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
                scoringApi.getTeams([matchData.team_a_id, matchData.team_b_id]),
                scoringApi.getPlayers(),
                scoringApi.getSquad(id),
                scoringApi.getLatestInnings(id),
            ]);
            let activeInnings = inningsRow || null;
            if (inningsRow?.innings_number === 1 && inningsRow.is_completed) {
                const { data: secondInnings } = await scoringApi.createSecondInnings({ match_id: matchData.id, innings_number: 2, batting_team_id: inningsRow.bowling_team_id, bowling_team_id: inningsRow.batting_team_id, target: inningsRow.total_runs + 1 });
                if (secondInnings)
                    activeInnings = secondInnings;
                else {
                    const { data: existingSecondInnings } = await scoringApi.getSecondInnings(id);
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
                const { data: ballRows } = await scoringApi.getInningsBalls(activeInnings.id);
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
    }, [id, isMasterAdmin, setAccessDenied, setBalls, setInnings, setLoading, setMatch, setPlayers, setSetup, setSquadPlayerIds, setTeams, setTossDecision, setTossWinner, userId]);
    useEffect(() => {
        const syncPending = async () => {
            if (!navigator.onLine)
                return;
            const items = await getOfflineQueue() as OfflineQueueItem<{
                ball: Json;
                inningsId: string;
                next: { striker_id?: string | null; non_striker_id?: string | null; is_completed?: boolean };
            }>[];
            const current = items.filter((item) => item.matchId === id);
            setOfflinePending(current.length);
            let synced = 0;
            for (const item of current) {
                const { error } = await scoringApi.recordDelivery({
                    p_ball: item.payload.ball,
                    p_next_striker_id: item.payload.next.striker_id || "",
                    p_next_non_striker_id: item.payload.next.non_striker_id || "",
                    p_innings_complete: Boolean(item.payload.next.is_completed),
                });
                if (error)
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
    }, [id, setOfflinePending]);
    useEffect(() => {
        const refreshPlayerPhotos = async () => {
            const { data } = await scoringApi.getPlayerPhotos();
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
    }, [setPlayers]);
    useEffect(() => {
        document.querySelectorAll<HTMLImageElement>(".score-hero-animated img[alt]").forEach((logo) => {
            const team = teams.find((item) => item.name === logo.alt);
            if (team) {
                const color = team.primary_color || "#38bdf8";
                logo.style.setProperty("border", `3px solid ${color}`, "important");
                logo.style.setProperty("outline", `4px solid ${color}`, "important");
                logo.style.setProperty("outline-offset", "3px", "important");
                logo.style.setProperty("box-shadow", `0 0 0 8px ${color}28, 0 0 24px ${color}`, "important");
                logo.style.setProperty("padding", "3px", "important");
                logo.style.setProperty("background", "#ffffff", "important");
                logo.style.setProperty("border-radius", "9999px", "important");
                logo.style.setProperty("box-sizing", "border-box", "important");
                logo.style.objectFit = "contain";
            }
        });
    }, [teams]);
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
    const ballsPerOver = match?.balls_per_over || 6;
    const configuredWickets = match?.wickets_per_innings || 10;
    const effectiveOvers = match?.revised_overs || match?.overs_per_match || 0;
    const score = innings ? `${innings.total_runs}/${innings.total_wickets}` : "0/0";
    const overs = innings ? `${Math.floor(innings.balls_bowled / ballsPerOver)}.${innings.balls_bowled % ballsPerOver}` : "0.0";
    const completed = match?.status === "completed" || innings?.is_completed;
    const winningTeamId = completed && innings?.innings_number === 2 && innings.target
        ? innings.total_runs >= innings.target ? innings.batting_team_id : innings.total_runs === innings.target - 1 ? null : innings.bowling_team_id
        : null;
    const winningTeam = teams.find((team) => team.id === winningTeamId) || null;
    const playerOfMatch = players.find((player) => player.id === match?.player_of_match_id) || null;
    const teamA = teams.find((team) => team.id === match?.team_a_id) || null;
    const teamB = teams.find((team) => team.id === match?.team_b_id) || null;
    const ballsRemaining = innings && match ? Math.max(effectiveOvers * ballsPerOver - innings.balls_bowled, 0) : 0;
    const runsNeeded = innings?.target ? Math.max(innings.target - innings.total_runs, 0) : 0;
    const currentRunRate = innings?.balls_bowled ? (innings.total_runs / innings.balls_bowled) * ballsPerOver : 0;
    const requiredRunRate = innings?.target && ballsRemaining ? (runsNeeded / ballsRemaining) * ballsPerOver : 0;
    const battingWinChance = (() => {
        if (!innings || innings.innings_number < 2 || !innings.target)
            return 50;
        if (runsNeeded === 0)
            return 100;
        if (ballsRemaining === 0 || innings.total_wickets >= configuredWickets)
            return 0;
        const wicketsRemaining = configuredWickets - innings.total_wickets;
        return Math.round(Math.min(95, Math.max(5, 50 + (currentRunRate - requiredRunRate) * 5 + (wicketsRemaining - 5) * 2)));
    })();
    const teamAWinChance = match?.status === "completed"
        ? winningTeamId === match.team_a_id ? 100 : winningTeamId === match.team_b_id ? 0 : 50
        : innings?.batting_team_id === match?.team_a_id ? battingWinChance : 100 - battingWinChance;
    const teamBWinChance = 100 - teamAWinChance;
    const requiresSetup = !innings?.striker_id || !innings?.non_striker_id || !innings?.current_bowler_id;
    useEffect(() => {
        const update = window.setTimeout(() => setShowCelebration(Boolean(winningTeamId)), 0);
        if (!winningTeamId) return () => window.clearTimeout(update);
        const timeout = window.setTimeout(() => setShowCelebration(false), 120000);
        return () => {
            window.clearTimeout(update);
            window.clearTimeout(timeout);
        };
    }, [setShowCelebration, winningTeamId]);
    useEffect(() => {
        if (!boundaryPop)
            return;
        const timeout = window.setTimeout(() => setBoundaryPop(null), 900);
        return () => window.clearTimeout(timeout);
    }, [boundaryPop, setBoundaryPop]);
    useEffect(() => {
        if (!wicketPop)
            return;
        const timeout = window.setTimeout(() => setWicketPop(null), 1050);
        return () => window.clearTimeout(timeout);
    }, [setWicketPop, wicketPop]);
    useEffect(() => {
        if (!hatTrickPop)
            return;
        const timeout = window.setTimeout(() => setHatTrickPop(null), 2400);
        return () => window.clearTimeout(timeout);
    }, [hatTrickPop, setHatTrickPop]);
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
    const eligibleNextBowlers = innings ? candidates(innings.bowling_team_id).filter((player) => player.id !== innings.current_bowler_id && legalBallsByBowler(player.id) < maxOversPerBowler * ballsPerOver) : [];
    const dismissedPlayerIds = new Set(balls.filter((ball) => ball.is_wicket && ball.player_out_id).map((ball) => ball.player_out_id));
    const eligibleNewBatters = innings ? candidates(innings.batting_team_id).filter((player) => player.id !== innings.striker_id && player.id !== innings.non_striker_id && !dismissedPlayerIds.has(player.id)) : [];
    const battingSideSize = innings ? candidates(innings.batting_team_id).length : 0;
    const wicketLimit = getWicketLimit({ squadSize: battingSideSize, configuredWickets, lastManStands: Boolean(match?.last_man_stands) });
    const isLastWicket = Boolean(innings && innings.total_wickets + 1 >= wicketLimit);
    const willActivateLastMan = Boolean(innings && shouldActivateLastMan({
        currentWickets: innings.total_wickets,
        wicketLimit,
        lastManStands: Boolean(match?.last_man_stands),
        availableReplacementBatters: eligibleNewBatters.length,
    }));
    const lastManActive = Boolean(
        match?.last_man_stands
        && innings
        && innings.total_wickets === wicketLimit - 1
        && innings.striker_id === innings.non_striker_id
    );
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
        const { error } = await scoringApi.updateInnings(innings.id, next);
        if (error)
            throw error;
        setInnings({ ...innings, ...next });
    };
    const assignPlayerOfMatch = async (winnerTeamId?: string | null) => {
        if (!match)
            return null;
        const { data: inningsRows, error: inningsError } = await scoringApi.getMatchInningsIds(match.id);
        if (inningsError || !inningsRows?.length)
            return null;
        const { data: matchBalls, error: ballsError } = await scoringApi.getPlayerOfMatchBalls(inningsRows.map((row: {
            id: string;
        }) => row.id));
        if (ballsError || !matchBalls?.length)
            return null;
        return rankPlayerOfMatch(matchBalls, players, winnerTeamId);
    };
    const startInnings = async () => {
        if (!match || setup.striker === setup.nonStriker || !setup.striker || !setup.nonStriker || !setup.bowler)
            return alert("Choose two different batters and one bowler.");
        setSaving(true);
        try {
            const battingTeam = innings?.innings_number === 2 ? innings.batting_team_id : setup.battingTeam;
            const bowling = innings?.innings_number === 2 ? innings.bowling_team_id : (battingTeam === match.team_a_id ? match.team_b_id : match.team_a_id);
            const payload = { match_id: match.id, innings_number: innings?.innings_number || 1, batting_team_id: battingTeam, bowling_team_id: bowling, striker_id: setup.striker, non_striker_id: setup.nonStriker, current_bowler_id: setup.bowler };
            const result = await scoringApi.saveInningsSetup(innings?.id || null, payload);
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
    const record = async ({ runs = 0, extras = 0, extrasType, legal = true, wicket = false, dismissalType, outId, fielderId, shotZone }: {
        runs?: number;
        extras?: number;
        extrasType?: string;
        legal?: boolean;
        wicket?: boolean;
        dismissalType?: string;
        outId?: string;
        fielderId?: string;
        shotZone?: "straight" | "cover" | "point" | "square_leg" | "midwicket" | "fine_leg";
    }) => {
        if (!innings || !match || saving || completed || innings.is_completed || requiresSetup)
            return;
        setRedoSnapshot(null);
        if (runs === 4 || runs === 6)
            setBoundaryPop({ runs, key: crypto.randomUUID() });
        setSaving(true);
        try {
            if (extrasType === "wide" && !match.allow_wides)
                throw new Error("Wides are disabled in this match's rules.");
            if (extrasType === "no_ball" && !match.allow_no_balls)
                throw new Error("No-balls are disabled in this match's rules.");
            const isOverEnd = legal && innings.balls_bowled % ballsPerOver === ballsPerOver - 1;
            const nextTotalRuns = innings.total_runs + runs + extras;
            const nextTotalWickets = innings.total_wickets + (wicket ? 1 : 0);
            const nextBallsBowled = innings.balls_bowled + (legal ? 1 : 0);
            const batterBefore = balls.filter((ball) => ball.batsman_id === innings.striker_id).reduce((total, ball) => total + ball.runs, 0);
            const bowlerBalls = balls.filter((ball) => ball.bowler_id === innings.current_bowler_id);
            const bowlerRuns = bowlerBalls.reduce((total, ball) => total + runsChargedToBowler(ball), 0)
                + runsChargedToBowler({ runs, extras, extras_type: extrasType });
            const currentWicket = { is_wicket: Boolean(wicket), dismissal_type: dismissalType || null };
            const bowlerWickets = bowlerBalls.filter(isBowlerCreditedWicket).length + (isBowlerCreditedWicket(currentWicket) ? 1 : 0);
            const deliveryIsHatTrick = isHatTrick(bowlerBalls, { is_legal: legal, ...currentWicket });
            const lastWicket = balls.map((ball) => ball.is_wicket).lastIndexOf(true);
            const partnership = balls.slice(lastWicket + 1).reduce((total, ball) => total + ball.runs + ball.extras, 0) + runs + extras;
            const allOut = wicket && nextTotalWickets >= wicketLimit;
            const oversComplete = nextBallsBowled >= effectiveOvers * ballsPerOver;
            const targetReached = innings.innings_number === 2 && Boolean(innings.target) && nextTotalRuns >= (innings.target || 0);
            const inningsComplete = allOut || oversComplete || targetReached;
            const matchResult = innings.innings_number === 2 && inningsComplete
                ? targetReached
                    ? `MATCH WON! ${teamName(innings.batting_team_id)} win by ${Math.max(candidates(innings.batting_team_id).length - 1 - nextTotalWickets, 0)} wicket${Math.max(candidates(innings.batting_team_id).length - 1 - nextTotalWickets, 0) === 1 ? "" : "s"}.`
                    : nextTotalRuns === (innings.target || 1) - 1
                        ? "Match tied."
                        : `MATCH WON! ${teamName(innings.bowling_team_id)} win by ${(innings.target || 1) - 1 - nextTotalRuns} run${(innings.target || 1) - 1 - nextTotalRuns === 1 ? "" : "s"}.`
                : undefined;
            let generatedCommentary = generateCommentary({
                over: Math.floor(innings.balls_bowled / ballsPerOver) + 1,
                ball: innings.balls_bowled % ballsPerOver + 1,
                batterName: playerName(innings.striker_id),
                bowlerName: playerName(innings.current_bowler_id),
                runs,
                extras,
                extrasType: extrasType as "wide" | "no_ball" | "bye" | "leg_bye" | undefined,
                shotZone,
                wicketType: dismissalType as "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket" | undefined,
                teamScore: nextTotalRuns,
                overs: `${Math.floor(nextBallsBowled / ballsPerOver)}.${nextBallsBowled % ballsPerOver}`,
                requiredRuns: innings.target ? Math.max(innings.target - nextTotalRuns, 0) : undefined,
                ballsRemaining: innings.target ? Math.max(effectiveOvers * ballsPerOver - nextBallsBowled, 0) : undefined,
                batterScore: batterBefore + runs,
                bowlerRuns,
                bowlerWickets,
                partnership,
                inningsComplete,
                matchResult,
            });
            if (deliveryIsHatTrick)
                generatedCommentary += ` HAT-TRICK! Three wickets in three consecutive legal deliveries for ${playerName(innings.current_bowler_id)}.`;
            const commentary = shotZone ? `${generatedCommentary} [zone:${shotZone}]` : generatedCommentary;
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
            if (wicket && willActivateLastMan) {
                const remainingBatter = outId === innings.striker_id ? innings.non_striker_id : innings.striker_id;
                striker = remainingBatter || "";
                nonStriker = remainingBatter || "";
            }
            const next = { total_runs: nextTotalRuns, total_wickets: nextTotalWickets, balls_bowled: nextBallsBowled, extras: (innings.extras || 0) + extras, overs_completed: Number(`${Math.floor(nextBallsBowled / ballsPerOver)}.${nextBallsBowled % ballsPerOver}`), is_completed: inningsComplete, striker_id: striker || null, non_striker_id: nonStriker || null };
            const ballPayload = { client_event_id: crypto.randomUUID(), innings_id: innings.id, over_number: Math.floor(innings.balls_bowled / ballsPerOver) + 1, ball_number: innings.balls_bowled % ballsPerOver + 1, batsman_id: innings.striker_id, non_striker_id: innings.non_striker_id, bowler_id: innings.current_bowler_id, runs, extras, extras_type: extrasType || null, is_legal: legal, is_wicket: wicket, dismissal_type: dismissalType || null, player_out_id: outId || null, fielder_id: fielderId || null, commentary };
            const { data: atomicData, error: ballError } = await scoringApi.recordDelivery({
                p_ball: ballPayload,
                p_next_striker_id: next.striker_id || "",
                p_next_non_striker_id: next.non_striker_id || "",
                p_innings_complete: inningsComplete,
            });
            if (ballError) {
                const offlineFailure = !navigator.onLine || /fetch|network|connection/i.test(ballError.message || "");
                if (!offlineFailure)
                    throw ballError;
                await saveToOfflineQueue(match.id, { ball: ballPayload, inningsId: innings.id, next });
                const queuedBall = { id: `offline-${crypto.randomUUID()}`, ...ballPayload } as Ball;
                setInnings({ ...innings, ...next });
                setBalls([...balls, queuedBall]);
                setOfflinePending((count) => count + 1);
                if (deliveryIsHatTrick)
                    setHatTrickPop({ bowlerName: playerName(innings.current_bowler_id), key: crypto.randomUUID() });
                speakCommentary(generatedCommentary);
                alert("Connection unavailable. Ball saved safely on this device and will sync automatically when online.");
                return;
            }
            const atomicResult = atomicData as { ball: Ball; innings: Innings };
            setInnings(atomicResult.innings);
            setBalls([...balls, atomicResult.ball]);
            if (deliveryIsHatTrick)
                setHatTrickPop({ bowlerName: playerName(innings.current_bowler_id), key: crypto.randomUUID() });
            speakCommentary(generatedCommentary);
            if (match.status === "scheduled") {
                setMatch({ ...match, status: "live" });
            }
            if (inningsComplete && innings.innings_number === 1) {
                const { data: secondInnings, error: secondInningsError } = await scoringApi.createSecondInningsStrict({ match_id: match.id, innings_number: 2, batting_team_id: innings.bowling_team_id, bowling_team_id: innings.batting_team_id, target: nextTotalRuns + 1 });
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
                const { error: finishError } = await scoringApi.updateMatch(match.id, { status: "completed", winner_id: winnerId, player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null });
                if (finishError)
                    throw finishError;
                setMatch({ ...match, status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null });
                if (match.tournament_id) await syncIplPlayoffMatches(supabase, match.tournament_id);
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
    const chooseRun = (runs: number) => {
        if (!innings || saving || completed || requiresSetup)
            return;
        setPendingRuns(runs);
    };
    const saveRunDirection = (shotZone: "straight" | "cover" | "point" | "square_leg" | "midwicket" | "fine_leg") => {
        if (pendingRuns === null)
            return;
        const runs = pendingRuns;
        setPendingRuns(null);
        void record({ runs, shotZone });
    };
    const saveBowler = async () => {
        if (!innings || !newBowler)
            return;
        if (newBowler === innings.current_bowler_id)
            return alert("The same bowler cannot bowl consecutive overs.");
        if (legalBallsByBowler(newBowler) >= maxOversPerBowler * ballsPerOver)
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
            const { error } = await scoringApi.updateMatch(match.id, { toss_winner_id: tossWinner, toss_decision: tossDecision });
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
    const openInterruption = () => {
        setRevisedOvers(String(match?.revised_overs || match?.overs_per_match || ""));
        setRevisedTarget(innings?.innings_number === 2 && innings.target ? String(innings.target) : "");
        setTargetMethod(match?.target_method === "dls" ? "dls" : "manual");
        setInterruptionNotes(match?.interruption_notes || "");
        setInterruptionOpen(true);
    };
    const saveInterruption = async () => {
        if (!match || !innings)
            return;
        const oversValue = Number(revisedOvers);
        const targetValue = revisedTarget ? Number(revisedTarget) : null;
        if (!Number.isInteger(oversValue) || oversValue < 1 || oversValue > match.overs_per_match)
            return alert(`Revised overs must be between 1 and ${match.overs_per_match}.`);
        if (innings.innings_number === 2 && (!targetValue || targetValue < 1))
            return alert("Enter the scorer-approved revised target for the chase.");
        setSaving(true);
        try {
            const { error: matchError } = await scoringApi.updateMatch(match.id, {
                revised_overs: oversValue,
                target_method: targetMethod,
                interruption_notes: interruptionNotes.trim() || null,
            });
            if (matchError)
                throw matchError;
            if (innings.innings_number === 2 && targetValue) {
                const { error: inningsError } = await scoringApi.updateInnings(innings.id, { target: targetValue });
                if (inningsError)
                    throw inningsError;
                setInnings({ ...innings, target: targetValue });
            }
            setMatch({ ...match, revised_overs: oversValue, target_method: targetMethod, interruption_notes: interruptionNotes.trim() || null });
            setInterruptionOpen(false);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to save interruption adjustment.");
        }
        finally {
            setSaving(false);
        }
    };
    const finish = async () => { if (!match || !confirm("Finish match and lock scoring?"))
        return; const playerOfMatch = await assignPlayerOfMatch(winningTeamId); const { error } = await scoringApi.updateMatch(match.id, { status: "completed", player_of_match_id: playerOfMatch?.playerId || null, player_of_match_summary: playerOfMatch?.summary || null }); if (error)
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
            const { data, error } = await scoringApi.undoDelivery({
                p_innings_id: innings.id,
            });
            if (error)
                throw error;
            const result = data as { ball: Ball; innings: Innings };
            setInnings(result.innings);
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
            const { data, error } = await scoringApi.recordDelivery({
                p_ball: ball,
                p_next_striker_id: restoredInnings.striker_id || "",
                p_next_non_striker_id: restoredInnings.non_striker_id || "",
                p_innings_complete: restoredInnings.is_completed,
            });
            if (error)
                throw error;
            const result = data as { ball: Ball; innings: Innings };
            setBalls([...balls, result.ball]);
            setInnings(result.innings);
            setRedoSnapshot(null);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : "Unable to redo the latest ball.");
        }
        finally {
            setSaving(false);
        }
    };
    const openWicket = (type: string) => { setWicketType(type); setWicketPop({ type, key: crypto.randomUUID() }); setPlayerOut(innings?.striker_id || ""); setNextBatter(""); setFielder(""); setWicketOpen(true); };
    const saveWicket = () => {
        if (freeHitActive && wicketType !== "run_out")
            return alert("Free Hit: only a run out dismissal is allowed.");
        if (!isLastWicket && !willActivateLastMan && !nextBatter)
            return alert("Select the next batter.");
        if (["caught", "run_out", "stumped"].includes(wicketType) && !fielder)
            return alert("Select the fielder involved.");
        record({ wicket: true, dismissalType: wicketType, outId: playerOut, fielderId: fielder || undefined });
    };
    const openAdvancedDelivery = (preferredType?: string) => {
        setAdvancedRuns(0);
        setAdvancedExtras(1);
        setAdvancedExtrasType(
            preferredType
            || (match?.allow_wides ? "wide" : match?.allow_no_balls ? "no_ball" : "bye")
        );
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
            if (command.includes("no ball") && match?.allow_no_balls)
                void record({ extras: 1, extrasType: "no_ball", legal: false });
            else if (command.includes("leg bye"))
                void record({ extras: 1, extrasType: "leg_bye", legal: true });
            else if (command.includes("wide") && match?.allow_wides)
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
        return <div className="mx-auto max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-amber-950"><LockKeyhole className="mx-auto h-10 w-10 text-amber-600"/><h1 className="mt-3 text-xl font-black">Scoring access locked</h1><p className="mt-2 text-sm">This match is locked to its assigned Tournament Organizer. Ask the Master Admin or tournament owner to change the scorer assignment.</p><Link href={localePath(locale, "/admin/matches")} className="mt-5 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white">Back to matches</Link></div>;
    if (!match)
        return <div className="p-8 text-center text-red-600">Match not found.</div>;
    return <div className="live-score-shell max-w-5xl mx-auto space-y-4 pb-12">
    {offlinePending > 0 && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-900">Offline safety queue: {offlinePending} ball{offlinePending === 1 ? "" : "s"} waiting to sync. Keep this device open; sync runs automatically when the connection returns.</div>}
    <header className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href={localePath(locale, "/admin/matches")} className="p-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5"/></Link><div><h1 className="font-bold text-xl">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)}</h1><p className="text-sm text-muted-foreground">{completed ? "Match completed" : saving ? "Saving ball…" : "Live scoring"}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={() => setTossOpen(true)} disabled={completed || saving} className="control">Toss</button><button onClick={() => setSetupOpen(true)} className="control"><Settings2 className="w-4 h-4 mr-1"/>Setup</button><button onClick={finish} disabled={completed || saving} className="control bg-primary text-primary-foreground"><CheckCircle2 className="w-4 h-4 mr-1"/>Finish</button>{completed && innings?.innings_number === 2 && innings.target ? <p className="w-full text-right text-xs font-bold uppercase tracking-wide text-foreground">{innings.total_runs >= innings.target ? `${teamName(innings.batting_team_id)} win by ${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0)} wicket${Math.max(candidates(innings.batting_team_id).length - 1 - innings.total_wickets, 0) === 1 ? "" : "s"}.` : innings.total_runs === innings.target - 1 ? "Match tied." : `${teamName(innings.bowling_team_id)} win by ${innings.target - 1 - innings.total_runs} run${innings.target - 1 - innings.total_runs === 1 ? "" : "s"}.`}</p> : match.toss_winner_id && match.toss_decision && <p className="w-full text-right text-xs uppercase tracking-wide text-muted-foreground"><strong className="text-foreground">{teamName(match.toss_winner_id)}</strong> have won the toss and have opted to <strong className="text-foreground">{match.toss_decision === "bat" ? "bat" : "bowl"}</strong>.</p>}</div></header>
    <section className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-card p-3" aria-label="Voice tools"><label className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><span>Commentary voice</span><span className="relative inline-flex"><select aria-label="Commentary voice language" value={commentaryVoice} onChange={(event) => changeCommentaryVoice(event.target.value)} className="commentary-voice-select min-h-10 w-auto appearance-none rounded-lg border py-1 pl-3 pr-9 text-xs font-bold shadow-inner outline-none focus:ring-2 focus:ring-cyan-300/40"><option value="en-IN">English — India</option><option value="en-GB">English — UK</option><option value="en-US">English — US</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current"/></span></label><button type="button" onClick={toggleAutoCommentary} aria-pressed={autoCommentary} className={`control ${autoCommentary ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : ""}`}>{autoCommentary ? <Volume2 className="mr-1.5 h-4 w-4"/> : <VolumeX className="mr-1.5 h-4 w-4"/>}{autoCommentary ? "Auto Commentary On" : "Auto Commentary Off"}</button><button type="button" onClick={startVoiceScoring} disabled={voiceListening || saving || completed || requiresSetup} className="control"><span className="relative mr-1.5">{voiceListening ? <MicOff className="h-4 w-4 text-red-500"/> : <Mic className="h-4 w-4 text-primary"/>}</span>{voiceListening ? "Listening…" : "Voice Score"}</button><button type="button" onClick={() => void handoverScoring()} className="control"><Share2 className="mr-1 h-4 w-4"/>Scorer Handover</button><Link href={localePath(locale, `/admin/matches/analytics/${id}`)} className="control"><BarChart3 className="mr-1 h-4 w-4"/>Advanced Analytics</Link><Link href={localePath(locale, `/admin/matches/scorecard/${id}`)} className="control"><FileText className="w-4 h-4 mr-1"/>Scorecard & Match Summary</Link></section>
    {voiceMessage && <div role="status" className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">{voiceMessage}</div>}
    {requiresSetup && <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">Choose batting team, opening pair and bowler before recording a ball. <button onClick={() => setSetupOpen(true)} className="underline font-semibold">Open setup</button></div>}
    <section className="score-hero-animated text-white p-7 rounded-xl shadow-lg"><div className="flex justify-between text-sm opacity-80"><span>{innings ? `${teamName(innings.batting_team_id)} batting` : "Innings not started"}</span><span>Overs {overs} / {match.overs_per_match}.0</span></div>{freeHitActive && <div className="mx-auto mt-3 w-fit rounded-full border border-amber-200 bg-amber-400 px-4 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg">Free Hit</div>}<div className="grid grid-cols-[72px_1fr_72px] items-center gap-3 my-4"><div className="flex flex-col items-center justify-center gap-1.5">{teamA?.logo_url ? <Image unoptimized width={128} height={128} src={teamA.logo_url} alt={teamA.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_a_id).slice(0, 2)}</div>}<strong className="text-base leading-none text-white">{teamAWinChance}%</strong><span className="text-[0.62rem] font-bold uppercase leading-none text-cyan-100">Win</span></div><div className="relative text-center"><strong className="text-6xl">{score}</strong>{boundaryPop && <BoundaryPop key={boundaryPop.key} runs={boundaryPop.runs}/>}{showCelebration && winningTeam && <ScoreCelebration color={winningTeam.primary_color || "#facc15"} teamName={winningTeam.name}/>}<div className="mt-3 flex items-center justify-center gap-6 text-sm font-semibold"><p>CRR: <strong className="text-yellow-300">{currentRunRate.toFixed(2)}</strong></p>{innings?.innings_number === 2 && innings.target ? <p>RRR: <strong className="text-yellow-300">{runsNeeded === 0 ? "0.00" : ballsRemaining ? requiredRunRate.toFixed(2) : "—"}</strong></p> : null}{innings?.innings_number === 1 && <p>Proj. Score: <strong className="text-yellow-300">{innings.balls_bowled ? Math.round((innings.total_runs / innings.balls_bowled) * match.overs_per_match * 6) : 0}</strong></p>}</div></div><div className="flex flex-col items-center justify-center gap-1.5">{teamB?.logo_url ? <Image unoptimized width={128} height={128} src={teamB.logo_url} alt={teamB.name} className="h-14 w-14 rounded-full object-cover border-2 border-white/70 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-black">{teamName(match.team_b_id).slice(0, 2)}</div>}<strong className="text-base leading-none text-white">{teamBWinChance}%</strong><span className="text-[0.62rem] font-bold uppercase leading-none text-emerald-100">Win</span></div></div><div className="grid sm:grid-cols-3 gap-4 border-t border-white/20 pt-4 text-sm"><div className="flex items-center gap-3">{playerPhoto(innings?.striker_id || null) ? <Image unoptimized width={128} height={128} src={playerPhoto(innings?.striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-300"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">S</div>}<div><span className="opacity-70">Striker</span><p className="font-bold">{playerName(innings?.striker_id || null)} * <span className="text-yellow-300">{strikerStats.runs} ({strikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.non_striker_id || null) ? <Image unoptimized width={128} height={128} src={playerPhoto(innings?.non_striker_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/70"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">NS</div>}<div><span className="opacity-70">Non-striker</span><p className="font-bold">{playerName(innings?.non_striker_id || null)} <span className="text-yellow-300">{nonStrikerStats.runs} ({nonStrikerStats.balls})</span></p></div></div><div className="flex items-center gap-3">{playerPhoto(innings?.current_bowler_id || null) ? <Image unoptimized width={128} height={128} src={playerPhoto(innings?.current_bowler_id || null)!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-sky-300"/> : <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">B</div>}<div><span className="opacity-70">Bowler</span><p className="font-bold">{playerName(innings?.current_bowler_id || null)}</p></div></div></div></section>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 bg-sky-50 p-3 text-sky-950"><div><p className="text-sm font-black">{match.revised_overs ? `${match.target_method?.toUpperCase() || "REVISED"} adjustment active: ${effectiveOvers} overs` : "Rain / interruption controls"}</p><p className="text-xs">{match.interruption_notes || "Apply a scorer-approved revised innings length and chase target."}</p></div><button type="button" onClick={openInterruption} disabled={completed || saving || !innings} className="control interruption-adjust-button"><SlidersHorizontal className="mr-1.5 h-4 w-4"/>Adjust match</button></section>
    {lastManActive && <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-center text-sm font-black uppercase tracking-wider text-orange-900">Last Man Stands active — the remaining batter continues alone</div>}
    {winningTeam && <section className="overflow-hidden rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-950 shadow-sm"><div className="grid md:grid-cols-2"><div className="flex items-center gap-4 p-5">{winningTeam.logo_url ? <Image unoptimized width={128} height={128} src={winningTeam.logo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 bg-white"/> : <div className="h-14 w-14 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center font-black">WIN</div>}<div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Match won</p><p className="text-xl font-black">{winningTeam.name} WIN!</p><p className="text-sm font-semibold">A memorable victory by {(innings?.total_runs || 0) >= (innings?.target || Infinity) ? `${Math.max(candidates(innings?.batting_team_id || "").length - 1 - (innings?.total_wickets || 0), 0)} wickets` : `${(innings?.target || 1) - 1 - (innings?.total_runs || 0)} runs`}.</p></div></div>{match.player_of_match_id && <div className="flex items-center gap-3 border-t border-emerald-300/70 bg-white/45 p-5 md:border-l md:border-t-0">{playerOfMatch?.photo_url ? <Image unoptimized width={128} height={128} src={playerOfMatch.photo_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-400 ring-offset-2"/> : <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-black">POM</div>}<div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Player of the Match</p><p className="truncate text-lg font-black">{playerName(match.player_of_match_id)}</p><p className="text-sm font-semibold">{match.player_of_match_summary}</p></div></div>}</div></section>}
    {innings?.innings_number === 2 && innings.target && <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center"><div className="bg-card p-3"><p className="text-xs text-muted-foreground">TARGET</p><p className="font-bold text-lg">{innings.target}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">NEED</p><p className="font-bold text-lg">{Math.max(innings.target - innings.total_runs, 0)}</p></div><div className="bg-card p-3"><p className="text-xs text-muted-foreground">BALLS LEFT</p><p className="font-bold text-lg">{ballsRemaining}</p></div></section>}
    <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Shot direction</h2><p className="mt-1 text-xs text-muted-foreground">Select the runs first. Then choose where the shot was played for an accurate Wagon Wheel and live commentary.</p></section>
    <div className="grid lg:grid-cols-2 gap-4"><div className="space-y-3"><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold mb-3">Runs</h2><div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 6].map((run) => <button key={run} onClick={() => chooseRun(run)} disabled={saving || completed || requiresSetup} className="score-button">{run}</button>)}</div></section><div className="grid grid-cols-2 gap-2"><button onClick={undoLastBall} disabled={!balls.length || saving || completed} className="control w-full justify-center"><RotateCcw className="mr-2 h-4 w-4"/>Undo</button><button onClick={redoLastBall} disabled={!redoSnapshot || saving || completed} className="control w-full justify-center"><RotateCw className="mr-2 h-4 w-4"/>Redo</button></div><section className="grid grid-cols-2 gap-3" aria-label="Quick player changes"><button type="button" onClick={openNewBatter} disabled={!innings || saving || completed} className="control min-h-16 justify-center rounded-xl border-primary/30 bg-card text-base shadow-sm hover:border-primary"><UserPlus className="mr-2 h-5 w-5 text-primary"/>New Batter</button><button type="button" onClick={() => { setNewBowler(""); setNextBowlerOpen(true); }} disabled={!innings || saving || completed} className="control min-h-16 justify-center rounded-xl border-primary/30 bg-card text-base shadow-sm hover:border-primary"><ArrowRightLeft className="mr-2 h-5 w-5 text-primary"/>Swap Bowler</button></section></div><div className="space-y-4"><section className="bg-card border border-border rounded-xl p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">Extras</h2><button type="button" onClick={() => openAdvancedDelivery()} disabled={saving || completed || requiresSetup} className="control min-h-10 px-3 text-xs"><SlidersHorizontal className="mr-1.5 h-4 w-4"/>Advanced</button></div><div className="grid grid-cols-4 gap-2">{[["Wd", "wide", false], ["NB", "no_ball", false], ["B", "bye", true], ["LB", "leg_bye", true]].map(([label, type, legal]) => <button key={String(type)} onClick={() => type === "no_ball" ? openAdvancedDelivery("no_ball") : record({ extras: 1, extrasType: String(type), legal: Boolean(legal) })} disabled={saving || completed || requiresSetup} className="small-button">{label}</button>)}</div><p className="mt-2 text-[0.7rem] text-muted-foreground">NB opens Advanced so bat runs and the mandatory no-ball can be recorded as one delivery.</p></section><section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold text-red-600 mb-3">Wicket</h2>{freeHitActive && <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">Free Hit active — only Run Out is available.</p>}<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[["bowled", "Bowled"], ["caught", "Caught"], ["lbw", "LBW"], ["stumped", "Stumping"], ["run_out", "Run Out"], ["hit_wicket", "Hit Wicket"], ["obstructing_field", "Obstructing"], ["timed_out", "Timed Out"]].map(([type, label]) => <button key={type} onClick={() => openWicket(type)} disabled={saving || completed || requiresSetup || (freeHitActive && type !== "run_out")} className="small-button text-red-600 disabled:text-muted-foreground">{label}</button>)}</div></section></div></div>
    <section className="bg-card border border-border rounded-xl overflow-hidden"><div className="grid grid-cols-[90px_1fr_86px] bg-primary border-b border-primary px-4 py-2 text-sm font-bold text-primary-foreground"><span>Overs</span><span>Balls</span><span className="text-right text-primary-foreground">Runs</span></div>{currentOverBalls.length ? <div className="grid grid-cols-[90px_1fr_86px] min-h-20"><div className="border-r border-border px-4 py-4"><p className="font-medium">Ov {currentOverNumber}</p><p className="mt-2 text-sm text-muted-foreground">{innings ? `${innings.total_runs}-${innings.total_wickets}` : "0-0"}</p></div><div className="px-4 py-4 min-w-0"><p className="text-sm text-muted-foreground truncate">{playerName(currentOverBowler)} to {playerName(currentOverBatter)}</p><div className="flex flex-wrap gap-2 mt-2">{currentOverBalls.map((ball) => <span key={ball.id} title={`${ball.over_number}.${ball.ball_number}`} className={`inline-flex h-6 min-w-6 px-1 items-center justify-center rounded text-xs font-bold ${ball.is_wicket ? "bg-red-600 text-white" : ball.extras_type ? "bg-amber-500 text-white" : ball.runs === 4 || ball.runs === 6 ? "bg-sky-600 text-white" : "bg-muted text-foreground"}`}>{deliveryBadgeLabel(ball)}</span>)}</div></div><div className="border-l border-border px-4 py-4 flex items-center justify-end font-bold">{currentOverRuns}</div></div> : <div className="px-4 py-5 text-sm text-muted-foreground">No balls recorded in this over.</div>}</section>
    {wicketPop && <WicketPop key={wicketPop.key} type={wicketPop.type}/>}
    {hatTrickPop && <HatTrickPop key={hatTrickPop.key} bowlerName={hatTrickPop.bowlerName}/>}
    <LiveCommentary key={`${innings?.id || "new"}:${balls.length}`} inningsId={innings?.id || null}/>
    <nav aria-label="Mobile quick scoring" className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-7 gap-1 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur lg:hidden">{[0, 1, 2, 4, 6].map((run) => <button key={run} type="button" onClick={() => chooseRun(run)} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl bg-primary text-base font-black text-primary-foreground disabled:opacity-40">{run}</button>)}<button type="button" onClick={() => openAdvancedDelivery()} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl border border-amber-400 bg-amber-50 text-[0.65rem] font-black text-amber-950 disabled:opacity-40">EXTRA</button><button type="button" onClick={() => openWicket(freeHitActive ? "run_out" : "bowled")} disabled={saving || completed || requiresSetup} className="grid min-h-12 place-items-center rounded-xl bg-red-600 text-[0.7rem] font-black text-white disabled:opacity-40">WICKET</button></nav>
    {pendingRuns !== null && <Modal title={`${pendingRuns} run${pendingRuns === 1 ? "" : "s"} — where was the shot played?`} onClose={() => setPendingRuns(null)}><p className="text-sm text-muted-foreground">Choose the shot direction to save this ball and update the Wagon Wheel.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{([["straight", "Straight"], ["cover", "Cover"], ["point", "Point"], ["square_leg", "Square Leg"], ["midwicket", "Midwicket"], ["fine_leg", "Fine Leg"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => saveRunDirection(value)} className="small-button min-h-14 border-primary/30 text-base font-black hover:border-primary hover:bg-primary hover:text-primary-foreground">{label}</button>)}</div><button type="button" onClick={() => setPendingRuns(null)} className="control mt-4 w-full justify-center">Cancel</button></Modal>}
    {setupOpen && <Modal title={innings?.innings_number === 2 ? "Second innings setup" : "Start / correct innings"} onClose={() => setSetupOpen(false)}><Select label="Batting team" value={setup.battingTeam} onChange={(value) => setSetup({ battingTeam: value, striker: "", nonStriker: "", bowler: "" })} options={teams.map((team) => [team.id, team.name])}/><Select label="Striker" value={setup.striker} onChange={(value) => setSetup({ ...setup, striker: value })} options={battingPlayers.map((player) => [player.id, player.name])}/><Select label="Non-striker" value={setup.nonStriker} onChange={(value) => setSetup({ ...setup, nonStriker: value })} options={battingPlayers.filter((player) => player.id !== setup.striker).map((player) => [player.id, player.name])}/><Select label="First / current bowler" value={setup.bowler} onChange={(value) => setSetup({ ...setup, bowler: value })} options={bowlingPlayers.map((player) => [player.id, player.name])}/><ModalActions onCancel={() => setSetupOpen(false)} onSave={startInnings} saving={saving} label={innings?.innings_number === 2 ? "Start chase" : "Start scoring"}/></Modal>}
    {tossOpen && <Modal title="Match Toss" onClose={() => setTossOpen(false)}><Select label="Toss winner" value={tossWinner} onChange={setTossWinner} options={teams.map((team) => [team.id, team.name])}/><Select label="Decision" value={tossDecision} onChange={setTossDecision} options={[["bat", "Bat"], ["bowl", "Bowl"]]}/><ModalActions onCancel={() => setTossOpen(false)} onSave={saveToss} saving={saving} label="Save toss"/></Modal>}
    {interruptionOpen && <Modal title="Rain / interruption adjustment" onClose={() => setInterruptionOpen(false)}><p className="text-sm text-muted-foreground">Enter scorer-approved values. DLS records the official method; CrickPulse will not invent an unofficial target.</p><Select label="Target method" value={targetMethod} onChange={(value) => setTargetMethod(value as "manual" | "dls")} options={[["manual", "Manual / competition rule"], ["dls", "Official DLS target"]]}/><label className="block space-y-2 text-sm font-medium">Revised overs<input type="number" min="1" max={match.overs_per_match} value={revisedOvers} onChange={(event) => setRevisedOvers(event.target.value)} className="input"/></label>{innings?.innings_number === 2 && <label className="block space-y-2 text-sm font-medium">Revised target<input type="number" min="1" value={revisedTarget} onChange={(event) => setRevisedTarget(event.target.value)} className="input"/></label>}<label className="block space-y-2 text-sm font-medium">Interruption notes<textarea value={interruptionNotes} onChange={(event) => setInterruptionNotes(event.target.value)} className="input min-h-24" placeholder="Rain stopped play; official target supplied by tournament referee…"/></label><ModalActions onCancel={() => setInterruptionOpen(false)} onSave={saveInterruption} saving={saving} label="Apply adjustment"/></Modal>}
    {nextBowlerOpen && <Modal title="Over complete — choose next bowler" onClose={() => setNextBowlerOpen(false)}><p className="mb-3 text-sm text-muted-foreground">Select a different bowler. Maximum {maxOversPerBowler} overs per bowler in this match.</p><Select label="Next bowler" value={newBowler} onChange={setNewBowler} options={eligibleNextBowlers.map((player) => [player.id, `${player.name} (${Math.floor(legalBallsByBowler(player.id) / ballsPerOver)}.${legalBallsByBowler(player.id) % ballsPerOver} ov)`])}/><ModalActions onCancel={() => setNextBowlerOpen(false)} onSave={saveBowler} saving={saving} label="Confirm bowler"/></Modal>}
    {wicketOpen && <Modal title={`Wicket — ${wicketType.replaceAll("_", " ")}`} onClose={() => setWicketOpen(false)}><div className="rounded-md bg-muted p-3 text-sm"><span className="text-muted-foreground">Current bowler (auto): </span><strong>{playerName(innings?.current_bowler_id || null)}</strong></div><Select label="Player out" value={playerOut} onChange={setPlayerOut} options={lastManActive ? [[innings?.striker_id || "", `${playerName(innings?.striker_id || null)} (last batter)`]] : [[innings?.striker_id || "", `${playerName(innings?.striker_id || null)} (striker)`], [innings?.non_striker_id || "", `${playerName(innings?.non_striker_id || null)} (non-striker)`]]}/>{["caught", "run_out", "stumped"].includes(wicketType) && <Select label={wicketType === "run_out" ? "Run out completed by" : "Fielder"} value={fielder} onChange={setFielder} options={candidates(innings?.bowling_team_id || "").map((player) => [player.id, player.name])}/>} {willActivateLastMan ? <p className="rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-900">Last Man Stands activates now. The remaining batter continues alone.</p> : !isLastWicket ? <Select label="Next batter" value={nextBatter} onChange={setNextBatter} options={eligibleNewBatters.map((player) => [player.id, player.name])}/> : <p className="rounded-md bg-red-50 p-3 text-sm font-bold text-red-800">Final wicket — innings will close automatically.</p>}<ModalActions onCancel={() => setWicketOpen(false)} onSave={saveWicket} saving={saving} label="Save wicket"/></Modal>}
    {advancedDeliveryOpen && <Modal title="Advanced delivery" onClose={() => setAdvancedDeliveryOpen(false)}><Select label="Extras type" value={advancedExtrasType} onChange={(value) => { setAdvancedExtrasType(value); if (value !== "no_ball") setAdvancedRuns(0); }} options={([...(match.allow_wides ? [["wide", "Wide"]] : []), ...(match.allow_no_balls ? [["no_ball", "No ball"]] : []), ["bye", "Bye"], ["leg_bye", "Leg bye"]] as string[][])}/><NumberChoice label="Runs off the bat (no-ball only)" value={advancedRuns} values={[0, 1, 2, 3, 4, 5, 6]} onChange={setAdvancedRuns} disabled={advancedExtrasType !== "no_ball"}/><NumberChoice label="Extra runs (includes mandatory 1)" value={advancedExtras} values={[1, 2, 3, 4, 5]} onChange={setAdvancedExtras}/><p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">This records one <strong className="text-foreground">{advancedExtrasType === "no_ball" ? advancedRuns + advancedExtras > 1 ? `NB+${advancedRuns + advancedExtras - 1}` : "NB" : advancedExtrasType === "wide" ? advancedExtras > 1 ? `Wd+${advancedExtras - 1}` : "Wd" : advancedExtrasType.replace("_", " ")}</strong> delivery. Total added: <strong className="text-foreground">{advancedRuns + advancedExtras}</strong>.</p><ModalActions onCancel={() => setAdvancedDeliveryOpen(false)} onSave={saveAdvancedDelivery} saving={saving} label="Record delivery"/></Modal>}
    {newBatterOpen && <Modal title="Choose new batter" onClose={() => setNewBatterOpen(false)}><p className="text-sm text-muted-foreground">Select which batting position to replace, then choose an available player from the batting team.</p><Select label="Batting position" value={batterSlot} onChange={(value) => setBatterSlot(value as "striker_id" | "non_striker_id")} options={[["striker_id", `Striker - ${playerName(innings?.striker_id || null)}`], ["non_striker_id", `Non-striker - ${playerName(innings?.non_striker_id || null)}`]]}/><Select label="New batter" value={newBatter} onChange={setNewBatter} options={eligibleNewBatters.map((player) => [player.id, player.name])}/>{!eligibleNewBatters.length && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No available batters remain.</p>}<ModalActions onCancel={() => setNewBatterOpen(false)} onSave={saveNewBatter} saving={saving} label="Confirm batter"/></Modal>}
  </div>;
}
