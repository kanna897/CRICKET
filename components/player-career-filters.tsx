"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Loader2, RotateCcw, Target, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Ball = { innings_id: string; batsman_id: string | null; bowler_id: string | null; fielder_id: string | null; player_out_id: string | null; runs: number; extras: number; extras_type: string | null; is_legal: boolean; is_wicket: boolean; dismissal_type: string | null };
type Innings = { id: string; match_id: string; batting_team_id: string; bowling_team_id: string };
type Match = { id: string; tournament_id: string | null; team_a_id: string; team_b_id: string; match_date: string | null; created_at: string; overs_per_match: number; status: string };
type Tournament = { id: string; name: string; ball_type: string | null };
type Team = { id: string; name: string };
type MatchRow = { match: Match; opponent: string; runs: number; balls: number; wickets: number; conceded: number; legalBalls: number };

const emptyFilter = { year: "all", tournament: "all", format: "all", ballType: "all", opponent: "all" };

export function PlayerCareerFilters({ playerId }: { playerId: string }) {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filters, setFilters] = useState(emptyFilter);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const ballResult = await supabase.from("ball_by_ball")
        .select("innings_id,batsman_id,bowler_id,fielder_id,player_out_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type")
        .or(`batsman_id.eq.${playerId},bowler_id.eq.${playerId},fielder_id.eq.${playerId},player_out_id.eq.${playerId}`);
      const ballRows = (ballResult.data || []) as Ball[];
      const inningsIds = [...new Set(ballRows.map((ball) => ball.innings_id))];
      const inningsResult = inningsIds.length
        ? await supabase.from("innings").select("id,match_id,batting_team_id,bowling_team_id").in("id", inningsIds)
        : { data: [], error: null };
      const inningsRows = (inningsResult.data || []) as Innings[];
      const matchIds = [...new Set(inningsRows.map((row) => row.match_id))];
      const matchResult = matchIds.length
        ? await supabase.from("matches").select("id,tournament_id,team_a_id,team_b_id,match_date,created_at,overs_per_match,status").in("id", matchIds)
        : { data: [], error: null };
      const matchRows = (matchResult.data || []) as Match[];
      const tournamentIds = [...new Set(matchRows.map((row) => row.tournament_id).filter(Boolean) as string[])];
      const teamIds = [...new Set(matchRows.flatMap((row) => [row.team_a_id, row.team_b_id]))];
      const [tournamentResult, teamResult] = await Promise.all([
        tournamentIds.length ? supabase.from("tournaments").select("id,name,ball_type").in("id", tournamentIds) : Promise.resolve({ data: [], error: null }),
        teamIds.length ? supabase.from("teams").select("id,name").in("id", teamIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      setBalls(ballRows); setInnings(inningsRows); setMatches(matchRows);
      setTournaments((tournamentResult.data || []) as Tournament[]); setTeams((teamResult.data || []) as Team[]);
      setMessage(ballResult.error?.message || inningsResult.error?.message || matchResult.error?.message || tournamentResult.error?.message || teamResult.error?.message || "");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [playerId]);

  const tournamentById = useMemo(() => new Map(tournaments.map((row) => [row.id, row])), [tournaments]);
  const teamById = useMemo(() => new Map(teams.map((row) => [row.id, row.name])), [teams]);
  const rows = useMemo<MatchRow[]>(() => matches.map((match) => {
    const matchInnings = innings.filter((row) => row.match_id === match.id);
    const matchBalls = balls.filter((ball) => matchInnings.some((row) => row.id === ball.innings_id));
    const ownTeamId = matchInnings.find((row) => row.batting_team_id && matchBalls.some((ball) => ball.innings_id === row.id && ball.batsman_id === playerId))?.batting_team_id
      || matchInnings.find((row) => row.bowling_team_id && matchBalls.some((ball) => ball.innings_id === row.id && ball.bowler_id === playerId))?.bowling_team_id;
    const opponentId = ownTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;
    const batting = matchBalls.filter((ball) => ball.batsman_id === playerId);
    const bowling = matchBalls.filter((ball) => ball.bowler_id === playerId);
    return {
      match, opponent: teamById.get(opponentId) || "Opponent",
      runs: batting.reduce((sum, ball) => sum + Number(ball.runs || 0), 0),
      balls: batting.filter((ball) => ball.is_legal || !["wide"].includes(ball.extras_type || "")).length,
      wickets: bowling.filter((ball) => ball.is_wicket && !["run_out", "obstructing_field"].includes(ball.dismissal_type || "")).length,
      conceded: bowling.reduce((sum, ball) => sum + Number(ball.runs || 0) + (["wide", "no_ball"].includes(ball.extras_type || "") ? Number(ball.extras || 0) : 0), 0),
      legalBalls: bowling.filter((ball) => ball.is_legal).length,
    };
  }), [balls, innings, matches, playerId, teamById]);

  const filtered = useMemo(() => rows.filter(({ match, opponent }) => {
    const date = match.match_date || match.created_at;
    const tournament = match.tournament_id ? tournamentById.get(match.tournament_id) : null;
    return (filters.year === "all" || String(new Date(date).getFullYear()) === filters.year)
      && (filters.tournament === "all" || match.tournament_id === filters.tournament)
      && (filters.format === "all" || formatName(match.overs_per_match) === filters.format)
      && (filters.ballType === "all" || (tournament?.ball_type || "Not specified") === filters.ballType)
      && (filters.opponent === "all" || opponent === filters.opponent);
  }), [filters, rows, tournamentById]);

  const totals = useMemo(() => {
    const runs = filtered.reduce((sum, row) => sum + row.runs, 0);
    const wickets = filtered.reduce((sum, row) => sum + row.wickets, 0);
    const ballsFaced = filtered.reduce((sum, row) => sum + row.balls, 0);
    const conceded = filtered.reduce((sum, row) => sum + row.conceded, 0);
    const legalBalls = filtered.reduce((sum, row) => sum + row.legalBalls, 0);
    return { runs, wickets, ballsFaced, strikeRate: ballsFaced ? runs * 100 / ballsFaced : 0, economy: legalBalls ? conceded / (legalBalls / 6) : 0 };
  }, [filtered]);

  const years = [...new Set(matches.map((match) => String(new Date(match.match_date || match.created_at).getFullYear())))].sort().reverse();
  const formats = [...new Set(matches.map((match) => formatName(match.overs_per_match)))];
  const ballTypes = [...new Set(tournaments.map((row) => row.ball_type || "Not specified"))];
  const opponents = [...new Set(rows.map((row) => row.opponent))].sort();

  if (loading) return <section className="rounded-3xl border border-border bg-card p-8 text-center text-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-2 text-sm text-muted-foreground">Loading career intelligence…</p></section>;

  return <section className="overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent p-5 sm:p-6">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Career intelligence</p><h2 className="mt-1 text-xl font-black">Advanced career filters</h2><p className="mt-1 text-sm text-muted-foreground">Analyse performance by season, competition, format and opponent.</p></div>
      <button type="button" onClick={() => setFilters(emptyFilter)} className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-3 text-sm font-bold"><RotateCcw className="mr-2 h-4 w-4" />Reset</button>
    </div>
    <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-5">
      <CareerSelect label="Year" value={filters.year} onChange={(year) => setFilters({ ...filters, year })} options={years.map((value) => [value, value])} />
      <CareerSelect label="Tournament" value={filters.tournament} onChange={(tournament) => setFilters({ ...filters, tournament })} options={tournaments.map((row) => [row.id, row.name])} />
      <CareerSelect label="Format" value={filters.format} onChange={(format) => setFilters({ ...filters, format })} options={formats.map((value) => [value, value])} />
      <CareerSelect label="Ball type" value={filters.ballType} onChange={(ballType) => setFilters({ ...filters, ballType })} options={ballTypes.map((value) => [value, value])} />
      <CareerSelect label="Opponent" value={filters.opponent} onChange={(opponent) => setFilters({ ...filters, opponent })} options={opponents.map((value) => [value, value])} />
    </div>
    {message ? <p className="m-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : <>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <CareerMetric label="Matches" value={filtered.length} icon={<Trophy />} />
        <CareerMetric label="Runs" value={totals.runs} icon={<Target />} />
        <CareerMetric label="Strike rate" value={totals.strikeRate.toFixed(1)} icon={<BarChart3 />} />
        <CareerMetric label="Wickets" value={totals.wickets} icon={<Target />} />
        <CareerMetric label="Economy" value={totals.economy.toFixed(2)} icon={<BarChart3 />} />
        <CareerMetric label="Best score" value={Math.max(0, ...filtered.map((row) => row.runs))} icon={<Trophy />} />
      </div>
      <div className="border-t border-border p-5"><div className="mb-3 flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h3 className="font-black">Match-wise form</h3></div>
        <div className="space-y-2">{filtered.length ? [...filtered].sort((a, b) => new Date(b.match.match_date || b.match.created_at).getTime() - new Date(a.match.match_date || a.match.created_at).getTime()).map((row) =>
          <div key={row.match.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-border bg-muted/35 p-3 text-sm"><div className="min-w-0"><p className="truncate font-bold">vs {row.opponent}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.match.match_date || row.match.created_at))} · {tournamentById.get(row.match.tournament_id || "")?.name || "Independent match"}</p></div><p className="text-right"><strong>{row.runs}</strong><span className="block text-[.65rem] text-muted-foreground">RUNS</span></p><p className="text-right"><strong>{row.wickets}</strong><span className="block text-[.65rem] text-muted-foreground">WKTS</span></p></div>
        ) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No recorded matches match these filters.</p>}</div>
      </div>
    </>}
  </section>;
}

function CareerSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground"><option value="all">All {label.toLowerCase()}s</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}
function CareerMetric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-4"><span className="block h-4 w-4 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-3 text-2xl font-black">{value}</p><p className="text-[.65rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</p></div>;
}
function formatName(overs: number) { return overs <= 5 ? "T5" : overs <= 10 ? "T10" : overs <= 20 ? "T20" : overs <= 50 ? "ODI" : `${overs} overs`; }
