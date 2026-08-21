"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildScorecard } from "@/lib/scorecard";
import { MatchSummaryPoster } from "@/components/match-summary-poster";
import type { ScorecardBall, ScorecardInnings, ScorecardPlayer } from "@/types/scorecard";
import { localePath } from "@/lib/locale-path";

type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
type Tournament = { name: string; logo_url: string | null };
type Match = {
  id: string; status: string; player_of_match_id: string | null; player_of_match_summary: string | null;
  team_a_id: string; team_b_id: string; winner_id: string | null; tournament_id: string | null;
  match_number: number | null; toss_winner_id: string | null; toss_decision: string | null;
};

export function MatchScorecardPage({ publicMode = false }: { publicMode?: boolean }) {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<ScorecardPlayer[]>([]);
  const [innings, setInnings] = useState<ScorecardInnings[]>([]);
  const [balls, setBalls] = useState<ScorecardBall[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [summaryMatchNumber, setSummaryMatchNumber] = useState<number | null>(null);
  const [active, setActive] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: matchRow } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
      if (!matchRow) return;
      const [{ data: teamRows }, { data: playerRows }, { data: inningsRows }, { data: tournamentRow }, { data: tournamentMatches }] = await Promise.all([
        supabase.from("teams").select("id,name,logo_url,primary_color").in("id", [matchRow.team_a_id, matchRow.team_b_id]),
        supabase.from("players").select("id,name,team_id,photo_url"),
        supabase.from("innings").select("*").eq("match_id", id).order("innings_number"),
        matchRow.tournament_id
          ? supabase.from("tournaments").select("name,logo_url").eq("id", matchRow.tournament_id).maybeSingle()
          : Promise.resolve({ data: null }),
        matchRow.tournament_id
          ? supabase.from("matches").select("id,match_number,match_date,match_time,created_at").eq("tournament_id", matchRow.tournament_id)
          : Promise.resolve({ data: [] }),
      ]);
      const inningsIds = (inningsRows || []).map((row: { id: string }) => row.id);
      const { data: ballRows } = inningsIds.length
        ? await supabase.from("ball_by_ball").select("*").in("innings_id", inningsIds).order("created_at")
        : { data: [] };
      setMatch(matchRow);
      setTeams(teamRows || []);
      setPlayers(playerRows || []);
      setInnings(inningsRows || []);
      setBalls(ballRows || []);
      setTournament(tournamentRow || null);
      if (matchRow.match_number) {
        setSummaryMatchNumber(matchRow.match_number);
      } else {
        const orderedTournamentMatches = (tournamentMatches || []).sort((left, right) => {
          const leftKey = `${left.match_date || "9999-12-31"} ${left.match_time || "99:99"} ${String(left.match_number || 999999).padStart(6, "0")} ${left.created_at}`;
          const rightKey = `${right.match_date || "9999-12-31"} ${right.match_time || "99:99"} ${String(right.match_number || 999999).padStart(6, "0")} ${right.created_at}`;
          return leftKey.localeCompare(rightKey);
        });
        const position = orderedTournamentMatches.findIndex((item) => item.id === matchRow.id);
        setSummaryMatchNumber(position >= 0 ? position + 1 : null);
      }
    })();
  }, [id]);

  useEffect(() => {
    const refreshPlayerPhotos = async () => {
      const { data } = await supabase.from("players").select("id,photo_url");
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

  const teamName = useCallback((teamId: string | null) => teams.find((team) => team.id === teamId)?.name || "Team", [teams]);
  const cards = useMemo(
    () => innings.map((item) => ({ item, summary: buildScorecard(item, balls.filter((ball) => ball.innings_id === item.id), players) })),
    [innings, balls, players],
  );
  const selected = cards.find(({ item }) => item.innings_number === active) || cards[0];
  const pom = players.find((player) => player.id === match?.player_of_match_id);
  const pomPerformance = useMemo(() => {
    if (!match?.player_of_match_id) return null;
    return cards.reduce((total, card) => {
      const batting = card.summary.batting.find((row) => row.playerId === match.player_of_match_id);
      const bowling = card.summary.bowling.find((row) => row.playerId === match.player_of_match_id);
      return {
        runs: total.runs + (batting?.runs || 0),
        balls: total.balls + (batting?.balls || 0),
        wickets: total.wickets + (bowling?.wickets || 0),
        bowlingRuns: total.bowlingRuns + (bowling?.runs || 0),
        fours: total.fours + (batting?.fours || 0),
        sixes: total.sixes + (batting?.sixes || 0),
        notOut: total.notOut || batting?.dismissal === "not out",
      };
    }, { runs: 0, balls: 0, wickets: 0, bowlingRuns: 0, fours: 0, sixes: 0, notOut: false });
  }, [cards, match]);
  const result = useMemo(() => {
    if (!match?.winner_id) return match?.status === "completed" ? "Match completed" : "Match in progress";
    const winnerName = teamName(match.winner_id).replace(/\s+/g, " ").trim();
    const chase = cards.find(({ item }) => item.innings_number === 2);
    const firstInnings = cards.find(({ item }) => item.innings_number === 1);
    if (chase?.item.batting_team_id === match.winner_id) {
      const squadSize = players.filter((player) => player.team_id === match.winner_id).length;
      const wicketsRemaining = Math.max((squadSize || 11) - 1 - chase.summary.wickets, 0);
      return `${winnerName} win by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}.`;
    }
    const runMargin = Math.max((firstInnings?.summary.total || 0) - (chase?.summary.total || 0), 0);
    return `${winnerName} win by ${runMargin} run${runMargin === 1 ? "" : "s"}.`;
  }, [cards, match, players, teamName]);

  if (!match) return <div className="p-10 text-center text-muted-foreground">Loading scorecard...</div>;

  return <main className="scorecard-shell max-w-5xl mx-auto space-y-5 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href={publicMode ? localePath(locale, `/match/${id}`) : localePath(locale, `/admin/matches/score/${id}`)} className="control"><ArrowLeft className="w-4 h-4 mr-1" />{publicMode ? "Live match" : "Live scorer"}</Link>
      <div className="flex gap-2">
        <button onClick={() => setShowSummary(false)} className={`control ${!showSummary ? "bg-primary text-primary-foreground" : ""}`}><FileText className="w-4 h-4 mr-1" />Scorecard</button>
        <button onClick={() => setShowSummary(true)} className={`control ${showSummary ? "bg-primary text-primary-foreground" : ""}`}><Trophy className="w-4 h-4 mr-1" />Match Summary</button>
      </div>
    </header>
    {showSummary ? <MatchSummaryPoster
      teams={teams}
      innings={cards.map(({ item, summary }) => ({ ...item, summary }))}
      result={result}
      tournament={tournament}
      matchNumber={summaryMatchNumber}
      tossWinnerTeamId={match.toss_winner_id}
      winnerTeamId={match.winner_id}
      playerOfMatch={pom ? { name: pom.name, summary: match.player_of_match_summary || "", photo_url: pom.photo_url, ...pomPerformance } : null}
    /> : <>
      <section className="rounded-xl border border-amber-200/40 bg-[radial-gradient(circle_at_top_right,#1c62ba_0%,#0a1f4a_48%,#050b26_100%)] p-5 text-white shadow-xl">
        <p className="text-sm font-semibold text-amber-200">{result}</p>
        <h1 className="mt-1 text-2xl font-black tracking-wide">{teamName(match.team_a_id)} <span className="text-amber-300">vs</span> {teamName(match.team_b_id)}</h1>
        <div className="flex gap-2 mt-5">{cards.map(({ item }) => <button key={item.id} onClick={() => setActive(item.innings_number)} className={`control ${selected?.item.id === item.id ? "bg-primary text-primary-foreground" : ""}`}>{teamName(item.batting_team_id)} · Innings {item.innings_number}</button>)}</div>
      </section>
      {selected && <InningsTable summary={selected.summary} teamName={teamName(selected.item.batting_team_id)} teamLogo={teams.find((team) => team.id === selected.item.batting_team_id)?.logo_url || null} players={players} />}
    </>}
  </main>;
}

export default MatchScorecardPage;

function InningsTable({ summary, teamName, teamLogo, players }: { summary: ReturnType<typeof buildScorecard>; teamName: string; teamLogo: string | null; players: ScorecardPlayer[] }) {
  const player = (playerId: string) => players.find((item) => item.id === playerId);
  const avatar = (playerId: string, name: string) => {
    const photoUrl = player(playerId)?.photo_url;
    return photoUrl ? <Image unoptimized width={128} height={128} src={photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.62rem] font-black text-primary">{name.slice(0, 2).toUpperCase()}</span>;
  };
  return <section className="overflow-hidden rounded-xl border border-amber-200/40 bg-[#06122d] text-slate-100 shadow-xl">
    <div className="flex justify-between bg-gradient-to-r from-[#0d4e9c] via-[#0b3b83] to-[#071b49] p-4 text-white"><div className="flex items-center gap-3">{teamLogo ? <Image unoptimized width={128} height={128} src={teamLogo} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-amber-200 shadow-md" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xs font-black">{teamName.slice(0, 2)}</div>}<h2 className="font-black tracking-wide">{teamName}</h2></div><strong className="text-amber-200">{summary.total}/{summary.wickets} ({summary.overs} ov)</strong></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#0b2b61] text-left text-[0.82rem] font-black tracking-wide text-amber-200"><tr><th className="p-3 text-[0.92rem] font-black tracking-wide">Batter</th><th className="text-[0.92rem] font-black tracking-wide">Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>{summary.batting.map((row) => <tr key={row.playerId} className="border-t border-white/10"><td className="p-3 font-medium"><div className="flex items-center gap-2">{avatar(row.playerId, row.name)}<span className="text-[0.92rem] font-bold tracking-tight text-white">{row.name}{row.dismissal === "not out" && <sup className="ml-1 text-sm text-amber-300">★</sup>}</span></div></td><td className="capitalize text-slate-300">{row.dismissal}</td><td>{row.runs}</td><td>{row.balls}</td><td>{row.fours}</td><td>{row.sixes}</td><td className="font-bold text-cyan-200">{row.strikeRate}</td></tr>)}<tr className="border-t border-white/10 font-semibold text-amber-100"><td className="p-3">Extras</td><td colSpan={5} /><td>{summary.extras}</td></tr><tr className="bg-white/5 font-black text-white"><td className="p-3">Total</td><td colSpan={5}>{summary.overs} overs</td><td className="text-amber-200">{summary.total}/{summary.wickets}</td></tr></tbody></table></div>
    {summary.partnership.batters.length > 0 && <div className="border-t border-amber-200/20 bg-white/[0.04] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Current partnership</p><p className="mt-1 text-2xl font-black text-white">{summary.partnership.runs} runs <span className="text-sm font-semibold text-slate-400">({summary.partnership.balls} balls)</span></p></div><div className="flex -space-x-2">{summary.partnership.batters.map((batter) => <div key={batter.playerId} className="rounded-full ring-2 ring-[#06122d]">{avatar(batter.playerId, batter.name)}</div>)}</div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{summary.partnership.batters.map((batter) => <div key={batter.playerId} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">{avatar(batter.playerId, batter.name)}<div className="min-w-0"><p className="truncate text-sm font-bold text-white">{batter.name}</p><p className="text-xs font-semibold text-slate-300">{batter.runs} runs · {batter.balls} balls</p></div></div>)}</div></div>}
    <div className="border-t border-amber-200/20 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#0b2b61] text-left text-[0.82rem] font-black tracking-wide text-amber-200"><tr><th className="p-3">Bowler</th><th>O</th><th>R</th><th>W</th><th>WD</th><th>NB</th><th>ECO</th></tr></thead><tbody>{summary.bowling.map((row) => <tr key={row.playerId} className="border-t border-white/10"><td className="p-3 font-medium"><div className="flex items-center gap-2">{avatar(row.playerId, row.name)}<span className="text-[0.92rem] font-bold tracking-tight text-white">{row.name}</span></div></td><td>{Math.floor(row.balls / 6)}.{row.balls % 6}</td><td>{row.runs}</td><td className="font-bold text-amber-200">{row.wickets}</td><td>{row.wides}</td><td>{row.noBalls}</td><td className="font-bold text-cyan-200">{row.economy}</td></tr>)}</tbody></table></div>
    {summary.fallOfWickets.length > 0 && <div className="border-t border-amber-200/20 p-4"><h3 className="mb-2 font-black tracking-wide text-amber-200">Fall of wickets</h3><div className="flex flex-wrap gap-2">{summary.fallOfWickets.map((item, index) => <span key={`${item.player}-${index}`} className="rounded border border-white/15 bg-white/10 px-2 py-1 text-xs text-slate-100">{item.player} {item.score}/{index + 1} · {item.over}</span>)}</div></div>}
  </section>;
}
