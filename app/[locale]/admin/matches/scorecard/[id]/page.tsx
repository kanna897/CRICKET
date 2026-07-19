"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildScorecard } from "@/lib/scorecard";
import { MatchSummaryPoster } from "@/components/match-summary-poster";
import type { ScorecardBall, ScorecardInnings, ScorecardPlayer } from "@/types/scorecard";

type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
type Tournament = { name: string; logo_url: string | null };
type Match = {
  id: string; status: string; player_of_match_id: string | null; player_of_match_summary: string | null;
  team_a_id: string; team_b_id: string; winner_id: string | null; tournament_id: string | null;
  match_number: number | null; toss_winner_id: string | null; toss_decision: string | null;
};

export default function MatchScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<ScorecardPlayer[]>([]);
  const [innings, setInnings] = useState<ScorecardInnings[]>([]);
  const [balls, setBalls] = useState<ScorecardBall[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [active, setActive] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: matchRow } = await (supabase.from("matches") as any).select("*").eq("id", id).maybeSingle();
      if (!matchRow) return;
      const [{ data: teamRows }, { data: playerRows }, { data: inningsRows }, { data: tournamentRow }] = await Promise.all([
        (supabase.from("teams") as any).select("id,name,logo_url,primary_color").in("id", [matchRow.team_a_id, matchRow.team_b_id]),
        (supabase.from("players") as any).select("id,name,photo_url"),
        (supabase.from("innings") as any).select("*").eq("match_id", id).order("innings_number"),
        matchRow.tournament_id
          ? (supabase.from("tournaments") as any).select("name,logo_url").eq("id", matchRow.tournament_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const inningsIds = (inningsRows || []).map((row: { id: string }) => row.id);
      const { data: ballRows } = inningsIds.length
        ? await (supabase.from("ball_by_ball") as any).select("*").in("innings_id", inningsIds).order("created_at")
        : { data: [] };
      setMatch(matchRow);
      setTeams(teamRows || []);
      setPlayers(playerRows || []);
      setInnings(inningsRows || []);
      setBalls(ballRows || []);
      setTournament(tournamentRow || null);
    })();
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

  const teamName = (teamId: string | null) => teams.find((team) => team.id === teamId)?.name || "Team";
  const cards = useMemo(
    () => innings.map((item) => ({ item, summary: buildScorecard(item, balls.filter((ball: any) => ball.innings_id === item.id), players) })),
    [innings, balls, players],
  );
  const selected = cards.find(({ item }) => item.innings_number === active) || cards[0];
  const pom = players.find((player) => player.id === match?.player_of_match_id);
  const result = match?.winner_id ? `${teamName(match.winner_id)} won the match` : match?.status === "completed" ? "Match completed" : "Match in progress";

  if (!match) return <div className="p-10 text-center text-muted-foreground">Loading scorecard...</div>;

  return <main className="max-w-5xl mx-auto space-y-5 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href={`/admin/matches/score/${id}`} className="control"><ArrowLeft className="w-4 h-4 mr-1" />Live scorer</Link>
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
      matchNumber={match.match_number}
      tossWinnerTeamId={match.toss_winner_id}
      winnerTeamId={match.winner_id}
      playerOfMatch={pom ? { name: pom.name, summary: match.player_of_match_summary || "", photo_url: pom.photo_url } : null}
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

function InningsTable({ summary, teamName, teamLogo, players }: { summary: ReturnType<typeof buildScorecard>; teamName: string; teamLogo: string | null; players: ScorecardPlayer[] }) {
  const player = (playerId: string) => players.find((item) => item.id === playerId);
  const avatar = (playerId: string, name: string) => {
    const photoUrl = player(playerId)?.photo_url;
    return photoUrl ? <img src={photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.62rem] font-black text-primary">{name.slice(0, 2).toUpperCase()}</span>;
  };
  return <section className="overflow-hidden rounded-xl border border-amber-200/40 bg-[#06122d] text-slate-100 shadow-xl">
    <div className="flex justify-between bg-gradient-to-r from-[#0d4e9c] via-[#0b3b83] to-[#071b49] p-4 text-white"><div className="flex items-center gap-3">{teamLogo ? <img src={teamLogo} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-amber-200 shadow-md" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xs font-black">{teamName.slice(0, 2)}</div>}<h2 className="font-black tracking-wide">{teamName}</h2></div><strong className="text-amber-200">{summary.total}/{summary.wickets} ({summary.overs} ov)</strong></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#0b2b61] text-left text-[0.82rem] font-black tracking-wide text-amber-200"><tr><th className="p-3 text-[0.92rem] font-black tracking-wide">Batter</th><th className="text-[0.92rem] font-black tracking-wide">Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>{summary.batting.map((row) => <tr key={row.playerId} className="border-t border-white/10"><td className="p-3 font-medium"><div className="flex items-center gap-2">{avatar(row.playerId, row.name)}<span className="text-[0.92rem] font-bold tracking-tight text-white">{row.name}{row.dismissal === "not out" && <sup className="ml-1 text-sm text-amber-300">★</sup>}</span></div></td><td className="capitalize text-slate-300">{row.dismissal}</td><td>{row.runs}</td><td>{row.balls}</td><td>{row.fours}</td><td>{row.sixes}</td><td className="font-bold text-cyan-200">{row.strikeRate}</td></tr>)}<tr className="border-t border-white/10 font-semibold text-amber-100"><td className="p-3">Extras</td><td colSpan={5} /><td>{summary.extras}</td></tr><tr className="bg-white/5 font-black text-white"><td className="p-3">Total</td><td colSpan={5}>{summary.overs} overs</td><td className="text-amber-200">{summary.total}/{summary.wickets}</td></tr></tbody></table></div>
    <div className="border-t border-amber-200/20 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#0b2b61] text-left text-[0.82rem] font-black tracking-wide text-amber-200"><tr><th className="p-3">Bowler</th><th>O</th><th>R</th><th>W</th><th>WD</th><th>NB</th><th>ECO</th></tr></thead><tbody>{summary.bowling.map((row) => <tr key={row.playerId} className="border-t border-white/10"><td className="p-3 font-medium"><div className="flex items-center gap-2">{avatar(row.playerId, row.name)}<span className="text-[0.92rem] font-bold tracking-tight text-white">{row.name}</span></div></td><td>{Math.floor(row.balls / 6)}.{row.balls % 6}</td><td>{row.runs}</td><td className="font-bold text-amber-200">{row.wickets}</td><td>{row.wides}</td><td>{row.noBalls}</td><td className="font-bold text-cyan-200">{row.economy}</td></tr>)}</tbody></table></div>
    {summary.fallOfWickets.length > 0 && <div className="border-t border-amber-200/20 p-4"><h3 className="mb-2 font-black tracking-wide text-amber-200">Fall of wickets</h3><div className="flex flex-wrap gap-2">{summary.fallOfWickets.map((item, index) => <span key={`${item.player}-${index}`} className="rounded border border-white/15 bg-white/10 px-2 py-1 text-xs text-slate-100">{item.player} {item.score}/{index + 1} · {item.over}</span>)}</div></div>}
  </section>;
}
