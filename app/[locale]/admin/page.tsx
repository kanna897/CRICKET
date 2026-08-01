"use client";
 

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CircleDot,
  Clock3,
  MapPin,
  Plus,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cloudinaryLogoUrl } from "@/lib/media";
import { subscribeWithMonitoring } from "@/lib/monitoring/realtime";
import { useAdminAccess } from "@/components/admin-shell";

type Tournament = {
  id: string;
  name: string;
  logo_url: string | null;
  status: string;
  start_date: string | null;
  venue: string | null;
  created_at: string;
};

type Team = {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string | null;
};

type Player = { id: string; team_id: string | null };
type Registration = { id: string; tournament_id: string; status: string; created_at: string };

type Match = {
  id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  match_number: number | null;
  match_date: string | null;
  match_time: string | null;
  ground: string | null;
  status: string;
  created_at: string;
};

type Innings = {
  match_id: string;
  innings_number: number;
  batting_team_id: string;
  total_runs: number;
  total_wickets: number;
  balls_bowled: number;
};

const liveStatuses = ["live", "ongoing", "toss_done"];
const completedStatuses = ["completed", "finished"];

export default function AdminDashboard() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      let tournamentQuery = supabase.from("tournaments")
        .select("id,name,logo_url,status,start_date,venue,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
      const { data: tournamentRows } = await tournamentQuery;
      const scopedTournaments = (tournamentRows || []) as Tournament[];
      const tournamentIds = scopedTournaments.map((item) => item.id);

      const [teamResult, matchResult] = tournamentIds.length
        ? await Promise.all([
            supabase.from("teams")
              .select("id,tournament_id,name,logo_url")
              .in("tournament_id", tournamentIds)
              .is("deleted_at", null),
            supabase.from("matches")
              .select("id,tournament_id,team_a_id,team_b_id,match_date,match_time,ground,status,created_at")
              .in("tournament_id", tournamentIds)
              .order("created_at", { ascending: false })
              .limit(60),
          ])
        : [{ data: [] }, { data: [] }];

      const scopedTeams = (teamResult.data || []) as Team[];
      const scopedMatches = (matchResult.data || []) as Match[];
      const teamIds = scopedTeams.map((item) => item.id);
      const matchIds = scopedMatches.map((item) => item.id);
      const [playerResult, inningsResult, registrationResult] = await Promise.all([
        teamIds.length
          ? supabase.from("players").select("id,team_id").in("team_id", teamIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        matchIds.length
          ? supabase.from("innings")
              .select("match_id,innings_number,batting_team_id,total_runs,total_wickets,balls_bowled")
              .in("match_id", matchIds)
          : Promise.resolve({ data: [] }),
        tournamentIds.length
          ? supabase.from("player_registrations").select("id,tournament_id,status,created_at").in("tournament_id", tournamentIds).eq("status", "pending")
          : Promise.resolve({ data: [] }),
      ]);

      if (!active) return;
      setTournaments(scopedTournaments);
      setTeams(scopedTeams);
      setPlayers((playerResult.data || []) as Player[]);
      setMatches(scopedMatches);
      setInnings((inningsResult.data || []) as Innings[]);
      setRegistrations((registrationResult.data || []) as Registration[]);
      setLoading(false);
    }

    void loadDashboard();
    const channel = supabase
      .channel(`dashboard-v2:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_registrations" }, loadDashboard);
    subscribeWithMonitoring(channel, `dashboard-v2:${userId}`);
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isMasterAdmin, userId]);

  const today = new Date().toISOString().slice(0, 10);
  const liveMatches = matches.filter((match) => liveStatuses.includes(match.status)).slice(0, 2);
  const upcoming = matches
    .filter((match) => match.match_date && match.match_date >= today && ![...completedStatuses, "abandoned"].includes(match.status))
    .sort((a, b) => `${a.match_date}${a.match_time || ""}`.localeCompare(`${b.match_date}${b.match_time || ""}`))
    .slice(0, 3);
  const activeTournaments = tournaments.filter((item) => ["active", "ongoing"].includes(item.status)).length;
  const completedMatches = matches.filter((item) => completedStatuses.includes(item.status)).length;
  const playerCountByTeam = new Map(teams.map((item) => [item.id, players.filter((player) => player.team_id === item.id).length]));
  const teamsNeedingPlayers = teams.filter((item) => (playerCountByTeam.get(item.id) || 0) < 6);
  const incompleteFixtures = matches.filter((item) => !completedStatuses.includes(item.status) && (!item.match_date || !item.ground));
  const team = useCallback((id: string) => teams.find((item) => item.id === id), [teams]);
  const tournament = useCallback((id: string) => tournaments.find((item) => item.id === id), [tournaments]);
  const latestInnings = (matchId: string) =>
    innings
      .filter((item) => item.match_id === matchId)
      .sort((a, b) => b.innings_number - a.innings_number)[0];

  const recentActivity = useMemo(
    () =>
      [
        ...matches.slice(0, 4).map((match) => ({
          id: `match-${match.id}`,
          title: `${team(match.team_a_id)?.name || "Team A"} vs ${team(match.team_b_id)?.name || "Team B"}`,
          detail: `${tournament(match.tournament_id)?.name || "Tournament"} · ${match.status.replaceAll("_", " ")}`,
          href: `/admin/matches/score/${match.id}`,
          createdAt: match.created_at,
          kind: "match" as const,
        })),
        ...tournaments.slice(0, 3).map((item) => ({
          id: `tournament-${item.id}`,
          title: item.name,
          detail: `Tournament · ${item.status}`,
          href: `/admin/tournaments`,
          createdAt: item.created_at,
          kind: "tournament" as const,
        })),
      ]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [matches, tournaments, team, tournament],
  );

  const dashboardDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <div className="admin-themed-page dashboard-page dashboard-command-center space-y-5">
      <header className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow"><Sparkles className="h-4 w-4" /> Tournament command centre</p>
          <h1>Welcome back, {isMasterAdmin ? "Admin" : "Organizer"}! <span aria-hidden="true">👋</span></h1>
          <p>{isMasterAdmin ? "Monitor every competition and organizer workspace." : "Here’s what needs your attention across your tournaments today."}</p>
        </div>
        <div className="dashboard-date"><CalendarDays className="h-5 w-5" /><span>{dashboardDate}</span></div>
      </header>

      <section className="dashboard-metric-grid" aria-label="Tournament overview">
        <MetricCard icon={Trophy} tone="green" label="Total Tournaments" value={tournaments.length} detail={`${activeTournaments} active · ${Math.max(tournaments.length - activeTournaments, 0)} other`} loading={loading} />
        <MetricCard icon={Users} tone="violet" label="Total Teams" value={teams.length} detail={`${teams.length} registered squads`} loading={loading} />
        <MetricCard icon={ShieldCheck} tone="gold" label="Total Players" value={players.length} detail={`${players.length} available players`} loading={loading} />
        <MetricCard icon={Activity} tone="blue" label="Matches Played" value={matches.length} detail={`${liveMatches.length} live · ${completedMatches} completed`} loading={loading} />
      </section>

      <div className="dashboard-main-grid">
        <div className="space-y-5">
          <DashboardPanel
            title="Live Matches"
            meta={liveMatches.length ? `${liveMatches.length} live now` : "No match live"}
            href="/admin/matches"
          >
            <div className="dashboard-live-grid">
              {liveMatches.length ? liveMatches.map((match) => (
                <LiveMatchCard key={match.id} match={match} teamA={team(match.team_a_id)} teamB={team(match.team_b_id)} innings={latestInnings(match.id)} tournamentName={tournament(match.tournament_id)?.name} />
              )) : (
                <EmptyState icon={Radio} title="No live matches right now" text="Start a scheduled match when both teams are ready." action="/admin/matches" actionLabel="Open matches" />
              )}
            </div>
          </DashboardPanel>

          <div className="dashboard-lower-grid">
            <DashboardPanel title="Recent Tournaments" href="/admin/tournaments">
              <div className="dashboard-tournament-list">
                {tournaments.slice(0, 3).map((item) => (
                  <Link key={item.id} href="/admin/tournaments" className="dashboard-tournament-row">
                    <TeamMark name={item.name} logo={item.logo_url} size="lg" />
                    <span className="min-w-0 flex-1">
                      <strong>{item.name}</strong>
                      <small>{teams.filter((entry) => entry.tournament_id === item.id).length} teams · {matches.filter((entry) => entry.tournament_id === item.id).length} matches</small>
                    </span>
                    <StatusPill status={item.status} />
                  </Link>
                ))}
                {!tournaments.length && <EmptyState icon={Trophy} title="No tournaments yet" text="Create your first tournament to begin." />}
              </div>
            </DashboardPanel>

            <DashboardPanel title="Recent Activity" href="/admin/matches">
              <div className="dashboard-activity-list">
                {recentActivity.map((item) => (
                  <Link href={item.href} key={item.id} className="dashboard-activity-row">
                    <span className="dashboard-activity-icon">{item.kind === "match" ? <Activity /> : <Trophy />}</span>
                    <span className="min-w-0 flex-1"><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <ArrowRight />
                  </Link>
                ))}
                {!recentActivity.length && <EmptyState icon={CircleDot} title="Activity will appear here" text="New tournaments and matches are shown automatically." />}
              </div>
            </DashboardPanel>
          </div>
        </div>

        <aside className="space-y-5">
          <DashboardPanel title="Organizer Action Centre" meta={`${registrations.length + teamsNeedingPlayers.length + incompleteFixtures.length} items`}>
            <div className="dashboard-activity-list">
              <ActionQueueRow icon={UserCheck} tone="emerald" title={`${registrations.length} registration${registrations.length === 1 ? "" : "s"} waiting`} text="Review applications and assign approved players." href="/admin/player-registrations" action="Review" />
              <ActionQueueRow icon={Users} tone="violet" title={`${teamsNeedingPlayers.length} squad${teamsNeedingPlayers.length === 1 ? "" : "s"} need players`} text="Teams require at least 6 players for match readiness." href="/admin/teams" action="Fix squads" />
              <ActionQueueRow icon={ShieldAlert} tone="amber" title={`${incompleteFixtures.length} incomplete fixture${incompleteFixtures.length === 1 ? "" : "s"}`} text="Add missing match date or venue before match day." href="/admin/matches" action="Complete" />
            </div>
          </DashboardPanel>
          <DashboardPanel title="Upcoming Matches" href="/admin/matches">
            <div className="dashboard-upcoming-list">
              {upcoming.map((match) => (
                <Link key={match.id} href={`/admin/matches/score/${match.id}`} className="dashboard-upcoming-card">
                  <div className="dashboard-upcoming-teams">
                    <TeamMark name={team(match.team_a_id)?.name || "Team A"} logo={team(match.team_a_id)?.logo_url} />
                    <span><small>Match {match.match_number || "—"}</small><b>VS</b></span>
                    <TeamMark name={team(match.team_b_id)?.name || "Team B"} logo={team(match.team_b_id)?.logo_url} />
                  </div>
                  <p><CalendarDays />{formatDate(match.match_date)} <span>·</span> <Clock3 />{formatTime(match.match_time)}</p>
                  <p><MapPin />{match.ground || tournament(match.tournament_id)?.name || "Venue TBC"}</p>
                </Link>
              ))}
              {!upcoming.length && <EmptyState icon={CalendarDays} title="Schedule is clear" text="No upcoming matches are currently scheduled." />}
            </div>
          </DashboardPanel>

          <section className="dashboard-quick-actions" aria-labelledby="quick-actions-title">
            <div><p>Build the next match day</p><h2 id="quick-actions-title">Quick Actions</h2></div>
            <Link href="/admin/tournaments/new" className="dashboard-action-primary"><Plus />Create Tournament</Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/teams/new"><Users />Add Team</Link>
              <Link href="/admin/players/new"><UserPlus />Add Player</Link>
            </div>
            <Link href="/admin/matches/new" className="dashboard-action-secondary"><Radio />Create Match</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, tone, label, value, detail, loading }: { icon: typeof Trophy; tone: string; label: string; value: number; detail: string; loading: boolean }) {
  return <article className={`dashboard-metric-card dashboard-tone-${tone}`}><span className="dashboard-metric-icon"><Icon /></span><div><p>{label}</p><strong>{loading ? "—" : value}</strong><small>{detail}</small></div></article>;
}

function DashboardPanel({ title, meta, href, children }: { title: string; meta?: string; href?: string; children: React.ReactNode }) {
  return <section className="dashboard-panel"><header><div><h2>{title}</h2>{meta && <span><i />{meta}</span>}</div>{href && <Link href={href}>View all <ArrowRight /></Link>}</header>{children}</section>;
}

function LiveMatchCard({ match, teamA, teamB, innings, tournamentName }: { match: Match; teamA?: Team; teamB?: Team; innings?: Innings; tournamentName?: string }) {
  const battingTeam = innings?.batting_team_id === teamB?.id ? teamB : teamA;
  return <article className="dashboard-live-card">
    <div className="dashboard-live-meta"><span><Radio /> LIVE</span><small>{tournamentName || `Match ${match.match_number || ""}`}</small></div>
    <div className="dashboard-live-score">
      <TeamMark name={teamA?.name || "Team A"} logo={teamA?.logo_url} size="lg" />
      <div><strong>{innings ? `${innings.total_runs}/${innings.total_wickets}` : "0/0"}</strong><span>{innings ? `${Math.floor(innings.balls_bowled / 6)}.${innings.balls_bowled % 6} overs` : "Waiting to begin"}</span></div>
      <TeamMark name={teamB?.name || "Team B"} logo={teamB?.logo_url} size="lg" />
    </div>
    <p>{battingTeam?.name || "Match"} batting now</p>
    <Link href={`/admin/matches/score/${match.id}`}>Open live scoring <ArrowRight /></Link>
  </article>;
}

function TeamMark({ name, logo, size = "md" }: { name: string; logo?: string | null; size?: "md" | "lg" }) {
  return <span className={`dashboard-team-mark dashboard-team-mark-${size}`}>{logo ? <Image unoptimized width={128} height={128} src={cloudinaryLogoUrl(logo)} alt="" /> : <i>{name.slice(0, 2).toUpperCase()}</i>}<b>{name}</b></span>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`dashboard-status dashboard-status-${status.toLowerCase()}`}>{status.replaceAll("_", " ")}</span>;
}

function EmptyState({ icon: Icon, title, text, action, actionLabel }: { icon: typeof Trophy; title: string; text: string; action?: string; actionLabel?: string }) {
  return <div className="dashboard-empty"><Icon /><strong>{title}</strong><p>{text}</p>{action && <Link href={action}>{actionLabel}</Link>}</div>;
}

function ActionQueueRow({ icon: Icon, tone, title, text, href, action }: { icon: typeof Trophy; tone: "emerald" | "violet" | "amber"; title: string; text: string; href: string; action: string }) {
  const tones = { emerald: "bg-emerald-500/15 text-emerald-500", violet: "bg-violet-500/15 text-violet-500", amber: "bg-amber-500/15 text-amber-500" };
  return <Link href={href} className="dashboard-activity-row"><span className={`dashboard-activity-icon ${tones[tone]}`}><Icon /></span><span className="min-w-0 flex-1"><strong>{title}</strong><small className="whitespace-normal">{text}</small></span><span className="shrink-0 text-xs font-black text-primary">{action}</span></Link>;
}

function formatDate(value: string | null) {
  if (!value) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string | null) {
  if (!value) return "Time TBC";
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
