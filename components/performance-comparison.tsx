"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Download,
  ImageDown,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as htmlToImage from "html-to-image";
import { supabase } from "@/lib/supabase";
import { downloadPosterDataUrl, posterPixelRatio, posterQualityLabel, type PosterQuality } from "@/lib/poster-export";

type Mode = "players" | "teams";
type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
type Player = { id: string; name: string; team_id: string | null; photo_url: string | null; playing_role: string | null };
type Tournament = { id: string; name: string };
type Match = { id: string; tournament_id: string | null; team_a_id: string; team_b_id: string; winner_id: string | null; status: string };
type Innings = { id: string; match_id: string; batting_team_id: string; bowling_team_id: string; total_runs: number; total_wickets: number };
type Ball = { innings_id: string; batsman_id: string | null; bowler_id: string | null; fielder_id: string | null; runs: number; is_wicket: boolean; dismissal_type: string | null };
type Metrics = Record<string, number>;

export function PerformanceComparison({ audience }: { audience: "admin" | "public" }) {
  const [mode, setMode] = useState<Mode>("players");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<PosterQuality | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [tournamentResult, teamResult, playerResult, matchResult, inningsResult, ballResult] = await Promise.all([
        supabase.from("tournaments").select("id,name").is("deleted_at", null).order("name"),
        supabase.from("teams").select("id,name,logo_url,primary_color").is("deleted_at", null).order("name"),
        supabase.from("players").select("id,name,team_id,photo_url,playing_role").is("deleted_at", null).order("name"),
        supabase.from("matches").select("id,tournament_id,team_a_id,team_b_id,winner_id,status"),
        supabase.from("innings").select("id,match_id,batting_team_id,bowling_team_id,total_runs,total_wickets"),
        supabase.from("ball_by_ball").select("innings_id,batsman_id,bowler_id,fielder_id,runs,is_wicket,dismissal_type"),
      ]);
      if (!active) return;
      const teamRows = (teamResult.data || []) as Team[];
      const playerRows = (playerResult.data || []) as Player[];
      setTournaments((tournamentResult.data || []) as Tournament[]);
      setTeams(teamRows);
      setPlayers(playerRows);
      setMatches((matchResult.data || []) as Match[]);
      setInnings((inningsResult.data || []) as Innings[]);
      setBalls((ballResult.data || []) as Ball[]);
      setLeft(playerRows[0]?.id || "");
      setRight(playerRows[1]?.id || playerRows[0]?.id || "");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const scopedMatches = tournamentId ? matches.filter((match) => match.tournament_id === tournamentId) : matches;
  const scopedMatchIds = new Set(scopedMatches.map((match) => match.id));
  const scopedInnings = tournamentId ? innings.filter((item) => scopedMatchIds.has(item.match_id)) : innings;
  const scopedInningsIds = new Set(scopedInnings.map((item) => item.id));
  const scopedBalls = tournamentId ? balls.filter((ball) => scopedInningsIds.has(ball.innings_id)) : balls;
  const scopedTeamIds = new Set(scopedMatches.flatMap((match) => [match.team_a_id, match.team_b_id]));
  const scopedTeams = tournamentId ? teams.filter((team) => scopedTeamIds.has(team.id)) : teams;
  const scopedPlayers = tournamentId ? players.filter((player) => !!player.team_id && scopedTeamIds.has(player.team_id)) : players;
  const options = mode === "players" ? scopedPlayers : scopedTeams;
  const leftRow = options.find((item) => item.id === left);
  const rightRow = options.find((item) => item.id === right);
  const selectedTournament = tournaments.find((item) => item.id === tournamentId);

  function switchTournament(next: string) {
    setTournamentId(next);
    const nextMatches = next ? matches.filter((match) => match.tournament_id === next) : matches;
    const nextTeamIds = new Set(nextMatches.flatMap((match) => [match.team_a_id, match.team_b_id]));
    const rows = mode === "players"
      ? (next ? players.filter((player) => !!player.team_id && nextTeamIds.has(player.team_id)) : players)
      : (next ? teams.filter((team) => nextTeamIds.has(team.id)) : teams);
    setLeft(rows[0]?.id || "");
    setRight(rows[1]?.id || rows[0]?.id || "");
  }

  function switchMode(next: Mode) {
    setMode(next);
    const rows = next === "players" ? scopedPlayers : scopedTeams;
    setLeft(rows[0]?.id || "");
    setRight(rows[1]?.id || rows[0]?.id || "");
  }

  function playerMetrics(id: string): Metrics {
    let runs = 0;
    let ballsFaced = 0;
    let wickets = 0;
    let catches = 0;
    let boundaries = 0;
    scopedBalls.forEach((ball) => {
      const dismissal = (ball.dismissal_type || "").toLowerCase();
      if (ball.batsman_id === id) {
        runs += Number(ball.runs || 0);
        ballsFaced += 1;
        if (ball.runs === 4 || ball.runs === 6) boundaries += 1;
      }
      if (ball.bowler_id === id && ball.is_wicket && !dismissal.includes("run_out")) wickets += 1;
      if (ball.fielder_id === id && (dismissal.includes("caught") || dismissal.includes("run_out") || dismissal.includes("stump"))) catches += 1;
    });
    return {
      Runs: runs,
      "Strike rate": ballsFaced ? Number(((runs / ballsFaced) * 100).toFixed(1)) : 0,
      Wickets: wickets,
      Fielding: catches,
      Boundaries: boundaries,
    };
  }

  function teamMetrics(id: string): Metrics {
    const completed = scopedMatches.filter((match) => match.status === "completed" && (match.team_a_id === id || match.team_b_id === id));
    const wins = completed.filter((match) => match.winner_id === id).length;
    const batting = scopedInnings.filter((item) => item.batting_team_id === id);
    const bowling = scopedInnings.filter((item) => item.bowling_team_id === id);
    return {
      Played: completed.length,
      Wins: wins,
      "Win rate": completed.length ? Number(((wins / completed.length) * 100).toFixed(1)) : 0,
      Runs: batting.reduce((sum, item) => sum + Number(item.total_runs || 0), 0),
      Wickets: bowling.reduce((sum, item) => sum + Number(item.total_wickets || 0), 0),
    };
  }

  const metricFor = mode === "players" ? playerMetrics : teamMetrics;
  const leftMetrics = left ? metricFor(left) : {};
  const rightMetrics = right ? metricFor(right) : {};
  const chartData = Object.keys(leftMetrics).map((metric) => ({
    metric,
    left: leftMetrics[metric] || 0,
    right: rightMetrics[metric] || 0,
    leftRadar: normalize(leftMetrics[metric] || 0, rightMetrics[metric] || 0),
    rightRadar: normalize(rightMetrics[metric] || 0, leftMetrics[metric] || 0),
  }));
  const leftWins = chartData.filter((item) => item.left > item.right).length;
  const rightWins = chartData.filter((item) => item.right > item.left).length;

  async function downloadPoster(quality: PosterQuality) {
    if (!posterRef.current || !leftRow || !rightRow) return;
    setDownloading(quality);
    try {
      const dataUrl = await htmlToImage.toJpeg(posterRef.current, {
        cacheBust: true,
        quality: 0.99,
        pixelRatio: posterPixelRatio(posterRef.current, quality),
        width: 1080,
        height: 1080,
        backgroundColor: "#06142f",
        style: {
          transform: "none",
          transformOrigin: "center",
          margin: "0",
        },
      });
      await downloadPosterDataUrl(dataUrl, `${safeName(leftRow.name)}-vs-${safeName(rightRow.name)}-${quality}-comparison.jpg`);
    } finally {
      setDownloading(null);
    }
  }

  const directoryHref = audience === "admin"
    ? (mode === "players" ? "/admin/players" : "/admin/teams")
    : (mode === "players" ? "/players" : "/teams");

  return (
    <div className={`admin-themed-page dashboard-page admin-compare-page comparison-${audience} space-y-5`}>
      <header className="admin-compare-hero">
        <div>
          <p><Sparkles /> Performance intelligence</p>
          <h1>Compare side by side</h1>
          <span>Player form and team strength visualized from verified match records.</span>
        </div>
        <div className="admin-compare-switch" role="group" aria-label="Comparison type">
          <button onClick={() => switchMode("players")} className={mode === "players" ? "active" : ""}><UserRound />Player Compare</button>
          <button onClick={() => switchMode("teams")} className={mode === "teams" ? "active" : ""}><Shield />Team Compare</button>
        </div>
      </header>

      <section className="admin-compare-pickers">
        <label className="admin-compare-scope"><span>Performance scope</span><select value={tournamentId} onChange={(event) => switchTournament(event.target.value)}><option value="">Overall Performance</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
        <Picker label={mode === "players" ? "Player A" : "Team A"} value={left} onChange={setLeft} options={options} />
        <span className="admin-versus">VS</span>
        <Picker label={mode === "players" ? "Player B" : "Team B"} value={right} onChange={setRight} options={options} />
      </section>

      {loading ? <div className="admin-compare-loading">Loading verified performance data…</div> : leftRow && rightRow ? (
        <>
          <section className="admin-compare-identities">
            <Identity row={leftRow} mode={mode} tone="cyan" audience={audience} teamName={playerTeamName(leftRow, teams)} />
            <div className="admin-compare-verdict"><BarChart3 /><b>{leftWins === rightWins ? "Even contest" : leftWins > rightWins ? `${leftRow.name} leads` : `${rightRow.name} leads`}</b><span>{leftWins} metric wins · {rightWins} metric wins</span></div>
            <Identity row={rightRow} mode={mode} tone="violet" audience={audience} teamName={playerTeamName(rightRow, teams)} />
          </section>

          <div className="admin-compare-chart-grid">
            <ChartCard title="Performance profile" subtitle="Normalized strengths across every metric" icon={Activity}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="70%">
                  <PolarGrid stroke="rgba(125, 164, 190, .35)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "currentColor", fontSize: 11, fontWeight: 700 }} />
                  <Radar name={leftRow.name} dataKey="leftRadar" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.28} strokeWidth={2} />
                  <Radar name={rightRow.name} dataKey="rightRadar" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.24} strokeWidth={2} />
                  <Legend /><Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Raw metric comparison" subtitle="Actual verified totals and rates" icon={BarChart3}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: "currentColor", fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Tooltip /><Legend />
                  <Bar name={leftRow.name} dataKey="left" fill="#06b6d4" radius={[5, 5, 0, 0]} />
                  <Bar name={rightRow.name} dataKey="right" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="admin-compare-metrics">
            {chartData.map((item) => <MetricRow key={item.metric} label={item.metric} left={item.left} right={item.right} />)}
          </section>

          <section className="comparison-poster-section">
            <header>
              <div><p><ImageDown /> Auto comparison poster</p><h2>Share-ready 1080 × 1080 design</h2><span>Selections and verified statistics update this poster automatically.</span></div>
              <div className="comparison-poster-downloads">
                {(["4k"] as PosterQuality[]).map((quality) => (
                  <button key={quality} onClick={() => void downloadPoster(quality)} disabled={!!downloading}>
                    <Download />{downloading === quality ? `Preparing ${posterQualityLabel(quality)}…` : `Download ${posterQualityLabel(quality)} JPG`}
                  </button>
                ))}
              </div>
            </header>
            <div className="comparison-poster-preview">
              <ComparisonPoster
                ref={posterRef}
                mode={mode}
                left={leftRow}
                right={rightRow}
                leftMetrics={leftMetrics}
                rightMetrics={rightMetrics}
                scopeName={selectedTournament?.name || "Overall Performance"}
                leftTeamName={playerTeamName(leftRow, teams)}
                rightTeamName={playerTeamName(rightRow, teams)}
                leftColor="#08bde8"
                rightColor="#39dc85"
              />
            </div>
          </section>
        </>
      ) : <div className="admin-compare-loading">At least two {mode} are required for comparison.</div>}

      <footer className="admin-compare-footer"><Trophy /><span>Comparison updates from recorded ball-by-ball and completed match data.</span><Link href={directoryHref}>Open {mode} directory <ArrowRight /></Link></footer>
    </div>
  );
}

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function Identity({ row, mode, tone, audience, teamName }: { row: Team | Player; mode: Mode; tone: "cyan" | "violet"; audience: "admin" | "public"; teamName?: string }) {
  const photo = imageFor(row);
  const detail = mode === "players" && "playing_role" in row ? row.playing_role || "Player" : "Cricket team";
  const href = audience === "admin" ? `/admin/players/${row.id}` : `/players/${row.id}`;
  return <article className={`admin-compare-identity tone-${tone}`}><span>{photo ? <Image src={photo} alt="" width={128} height={128} sizes="128px" /> : mode === "players" ? <UserRound /> : <Users />}</span><div><small>{detail}</small><h2>{row.name}</h2>{teamName ? <p>{teamName}</p> : null}{mode === "players" && <Link href={href}>View profile <ArrowRight /></Link>}</div></article>;
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Activity; children: React.ReactNode }) {
  return <section className="admin-compare-chart"><header><Icon /><div><h2>{title}</h2><p>{subtitle}</p></div></header><div>{children}</div></section>;
}

function MetricRow({ label, left, right }: { label: string; left: number; right: number }) {
  const max = Math.max(left, right, 1);
  return <div><strong className={left > right ? "winner" : ""}>{left}</strong><span className="left-bar"><i style={{ width: `${(left / max) * 100}%` }} /></span><b>{label}</b><span className="right-bar"><i style={{ width: `${(right / max) * 100}%` }} /></span><strong className={right > left ? "winner" : ""}>{right}</strong></div>;
}

const ComparisonPoster = ({ ref, mode, left, right, leftMetrics, rightMetrics, leftColor, rightColor, scopeName, leftTeamName, rightTeamName }: {
  ref: React.Ref<HTMLDivElement>;
  mode: Mode;
  left: Team | Player;
  right: Team | Player;
  leftMetrics: Metrics;
  rightMetrics: Metrics;
  leftColor: string;
  rightColor: string;
  scopeName: string;
  leftTeamName?: string;
  rightTeamName?: string;
}) => {
  const labels = Object.keys(leftMetrics).slice(0, 5);
  return (
    <div
      ref={ref}
      className="comparison-poster"
      style={{
        "--poster-left": leftColor,
        "--poster-right": rightColor,
      } as React.CSSProperties}
    >
      <div className="comparison-poster-glow glow-left" /><div className="comparison-poster-glow glow-right" />
      <header><Image src="/brand/crickpulse-logo.png" alt="Crickpulse" width={180} height={64} className="poster-brand-logo" /><small>THE RHYTHM OF THE GAME</small></header>
      <div className="comparison-poster-title"><p>{mode === "players" ? "PLAYER" : "TEAM"} PERFORMANCE COMPARISON</p><h2>HEAD TO <em>HEAD</em></h2><span>{scopeName}</span></div>
      <div className="poster-contenders">
        <PosterSide row={left} mode={mode} metrics={leftMetrics} labels={labels} side="left" teamName={leftTeamName} />
        <div className="poster-vs">VS</div>
        <PosterSide row={right} mode={mode} metrics={rightMetrics} labels={labels} side="right" teamName={rightTeamName} />
      </div>
      <footer><span>PERFORMANCE INTELLIGENCE</span><div><Image src="/brand/crickpulse-logo.png" alt="Crickpulse" width={180} height={64} /><b>THE RHYTHM OF THE GAME</b></div></footer>
    </div>
  );
};

function PosterSide({ row, mode, metrics, labels, side, teamName }: { row: Team | Player; mode: Mode; metrics: Metrics; labels: string[]; side: "left" | "right"; teamName?: string }) {
  const photo = imageFor(row);
  return <section className={`poster-side poster-${side} poster-${mode}`}><div className="poster-photo">{photo ? <Image src={photo} alt="" crossOrigin="anonymous" width={512} height={512} sizes="512px" /> : mode === "players" ? <UserRound /> : <Shield />}</div><h3>{row.name}</h3><small>{teamName || (mode === "players" && "playing_role" in row ? row.playing_role || "PLAYER" : "CRICKET TEAM")}</small><div className="poster-stats">{labels.map((label) => <div key={label}><strong>{formatMetric(metrics[label])}</strong><span>{label}</span></div>)}</div></section>;
}

function playerTeamName(row: Team | Player, teams: Team[]) {
  if (!("team_id" in row) || !row.team_id) return undefined;
  return teams.find((team) => team.id === row.team_id)?.name;
}

function imageFor(row: Team | Player) {
  return "photo_url" in row ? row.photo_url : row.logo_url;
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalize(value: number, other: number) {
  const max = Math.max(value, other, 1);
  return Number(((value / max) * 100).toFixed(1));
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
