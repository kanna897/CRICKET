"use client";
 

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Eye,
  FileImage,
  FileText,
  Radio,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { supabase } from "@/lib/supabase";
import { subscribeWithMonitoring } from "@/lib/monitoring/realtime";
import { preload } from "react-dom";
import { cloudinaryLogoUrl } from "@/lib/media";

type Tournament = {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

type Team = { id: string; tournament_id: string | null; name: string; logo_url: string | null };
type Match = {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  status: string;
  match_date: string | null;
  match_time: string | null;
  ground: string | null;
  toss_winner_id: string | null;
  toss_decision: string | null;
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

export default function PublicHome() {
  preload("/landing/sangakkara-stadium-hero.png", { as: "image", fetchPriority: "high" });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadLanding() {
      const [tournamentResult, matchResult, playerResult] = await Promise.all([
        supabase.from("tournaments")
          .select("id,name,logo_url,banner_url,venue,start_date,end_date,status")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("matches")
          .select("id,tournament_id,team_a_id,team_b_id,status,match_date,match_time,ground,toss_winner_id,toss_decision,created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("players")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
      ]);
      const matchRows = (matchResult.data || []) as Match[];
      const matchIds = matchRows.map((item) => item.id);
      const tournamentIds = (tournamentResult.data || []).map((item) => item.id);
      const teamIds = [...new Set(matchRows.flatMap((item) => [item.team_a_id, item.team_b_id]))];
      const teamScopeFilters = [
        tournamentIds.length ? `tournament_id.in.(${tournamentIds.join(",")})` : "",
        teamIds.length ? `id.in.(${teamIds.join(",")})` : "",
      ].filter(Boolean).join(",");
      const [inningsResult, teamResult] = await Promise.all([
        matchIds.length ? supabase.from("innings")
            .select("match_id,innings_number,batting_team_id,total_runs,total_wickets,balls_bowled")
            .in("match_id", matchIds)
          : Promise.resolve({ data: [] }),
        tournamentIds.length || teamIds.length
          ? supabase.from("teams")
              .select("id,tournament_id,name,logo_url")
              .or(teamScopeFilters)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] }),
      ]);
      if (!active) return;
      setTournaments((tournamentResult.data || []) as Tournament[]);
      setTeams((teamResult.data || []) as Team[]);
      setMatches(matchRows);
      setInnings((inningsResult.data || []) as Innings[]);
      setPlayerCount(playerResult.count || 0);
    }

    void loadLanding();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadLanding(), 350);
    };
    const channel = supabase
      .channel("public-landing-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings" }, scheduleRefresh);
    subscribeWithMonitoring(channel, "public-landing-v2");
    return () => {
      active = false;
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const teamMap = useMemo(() => new Map(teams.map((item) => [item.id, item])), [teams]);
  const tournamentMap = useMemo(() => new Map(tournaments.map((item) => [item.id, item])), [tournaments]);
  const tournamentTeamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of teams) {
      if (item.tournament_id) counts.set(item.tournament_id, (counts.get(item.tournament_id) ?? 0) + 1);
    }
    return counts;
  }, [teams]);
  const tournamentMatchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of matches) {
      if (item.tournament_id) counts.set(item.tournament_id, (counts.get(item.tournament_id) ?? 0) + 1);
    }
    return counts;
  }, [matches]);
  const team = (id: string) => teamMap.get(id);
  const tournament = (id: string | null) => id ? tournamentMap.get(id) : undefined;
  const liveMatches = matches.filter((item) => item.status === "live");
  const featuredMatch = liveMatches[0] || matches[0];
  const featuredInnings = featuredMatch
    ? innings
        .filter((item) => item.match_id === featuredMatch.id)
        .sort((a, b) => b.innings_number - a.innings_number)[0]
    : undefined;
  const featuredTeamA = featuredMatch ? team(featuredMatch.team_a_id) : undefined;
  const featuredTeamB = featuredMatch ? team(featuredMatch.team_b_id) : undefined;
  const isFeaturedLive = featuredMatch?.status === "live";

  const visibleTournaments = useMemo(() => {
    const ordered = [...tournaments].sort((a, b) => {
      const weight = (status: string) => status === "ongoing" ? 0 : status === "upcoming" ? 1 : 2;
      return weight(a.status) - weight(b.status);
    });
    return ordered.slice(0, 4);
  }, [tournaments]);

  return (
    <div className="public-landing">
      <PublicNav />
      <main>
        <section className="landing-hero">
          <div className="landing-stadium-glow" />
          <div className="landing-hero-copy">
            <p className="landing-live-pill"><span /> Live cricket, real-time action</p>
            <h1>Every Ball.<br /><em>Every Moment.</em><br />One <em>Pulse.</em></h1>
            <p className="landing-intro">Stay connected to your tournament with live scores, detailed scorecards, team squads, player profiles and match posters — all without signing in.</p>
            <div className="landing-hero-actions">
              <Link href="/tournaments" className="landing-primary-button">Explore Tournaments <ArrowRight /></Link>
              <Link href={featuredMatch ? `/match/${featuredMatch.id}` : "/fixtures"} className="landing-outline-button"><Radio /> Public Live Scores <small>{isFeaturedLive ? "LIVE" : "SCORE"}</small></Link>
              <Link href="/fixtures" className="landing-outline-button">View Live Matches <span className="landing-red-dot" /></Link>
            </div>
            <div className="landing-feature-row">
              <FeatureMini icon={Zap} title="Live Scores" text="Real-time updates" />
              <FeatureMini icon={FileText} title="Scorecards" text="Ball-by-ball details" />
              <FeatureMini icon={Users} title="Team Squads" text="Players & lineups" />
              <FeatureMini icon={UserRound} title="Player Profiles" text="Stats & records" />
              <FeatureMini icon={FileImage} title="Match Posters" text="Save & share" />
            </div>
          </div>

          <div className="landing-player-visual" aria-hidden="true" />

          <article className="landing-featured-match">
            <header>
              <div><b>{isFeaturedLive ? "Live Match" : "Latest Match"}</b><span className={isFeaturedLive ? "is-live" : ""}>{isFeaturedLive ? "LIVE" : featuredMatch?.status || "READY"}</span></div>
              <small><Eye /> Public score</small>
            </header>
            {featuredMatch ? (
              <>
                <p className="landing-match-context">{tournament(featuredMatch.tournament_id)?.name || "CrickPulse Tournament"}</p>
                <div className="landing-match-score">
                  <TeamCrest team={featuredTeamA} />
                  <div><strong>{featuredInnings ? `${featuredInnings.total_runs}/${featuredInnings.total_wickets}` : "VS"}</strong><span>{featuredInnings ? `${Math.floor(featuredInnings.balls_bowled / 6)}.${featuredInnings.balls_bowled % 6} overs` : formatDate(featuredMatch.match_date)}</span></div>
                  <TeamCrest team={featuredTeamB} />
                </div>
                <p className="landing-toss">{featuredMatch.toss_winner_id ? `${team(featuredMatch.toss_winner_id)?.name || "Team"} won the toss and elected to ${featuredMatch.toss_decision || "bat"}` : `${featuredMatch.ground || "Venue TBC"} · ${formatDate(featuredMatch.match_date)}`}</p>
                <div className="landing-mini-scorecard">
                  <div><span>TEAM</span><span>STATUS</span></div>
                  <p><b>{featuredTeamA?.name || "Team A"}</b><strong>{featuredMatch.status}</strong></p>
                  <p><b>{featuredTeamB?.name || "Team B"}</b><strong>{featuredInnings ? `${featuredInnings.total_runs}/${featuredInnings.total_wickets}` : "—"}</strong></p>
                </div>
                <Link href={`/match/${featuredMatch.id}`}>View Full Scorecard <ArrowRight /></Link>
              </>
            ) : (
              <div className="landing-match-empty"><Radio /><b>Match centre is ready</b><p>Live coverage appears here when scoring begins.</p></div>
            )}
          </article>
        </section>

        <section className="landing-tournaments">
          <header><h2><Trophy /> Live Tournaments</h2><Link href="/tournaments">View All Tournaments <ArrowRight /></Link></header>
          <div className="landing-tournament-grid">
            {visibleTournaments.map((item, index) => (
              <Link href={`/tournaments/${item.id}`} key={item.id} className={`landing-tournament-card landing-tournament-${index % 4}`}>
                <div className="landing-tournament-art">
                  {item.banner_url && <Image fill sizes="(max-width: 640px) 100vw, 33vw" src={item.banner_url} alt="" className="landing-tournament-banner" />}
                  <StatusBadge status={item.status} />
                  {item.logo_url ? <Image unoptimized width={128} height={128} sizes="128px" src={cloudinaryLogoUrl(item.logo_url)} alt="" className="landing-tournament-logo" /> : <Trophy />}
                  <span>CRICKET LEAGUE</span>
                </div>
                <div><h3>{item.name}</h3><p><Users />{tournamentTeamCounts.get(item.id) ?? 0} teams <Activity />{tournamentMatchCounts.get(item.id) ?? 0} matches</p><small>{dateRange(item.start_date, item.end_date)}</small></div>
              </Link>
            ))}
            {!visibleTournaments.length && <div className="landing-no-tournament"><Trophy /><b>Tournaments coming soon</b></div>}
          </div>
        </section>

        <section className="landing-stat-strip" aria-label="CrickPulse statistics">
          <LandingStat icon={Trophy} value={`${tournaments.length}+`} label="Tournaments" />
          <LandingStat icon={ShieldCheck} value={`${teams.length}+`} label="Teams" />
          <LandingStat icon={Users} value={`${playerCount}+`} label="Players" />
          <LandingStat icon={Radio} value={`${matches.length}+`} label="Matches" />
          <LandingStat icon={Eye} value="24/7" label="Public Access" />
        </section>

        <section className="landing-bottom-cta">
          <div><span><Users /></span><p><b>Organizing a tournament?</b>Create, manage and showcase your tournament with CrickPulse.<Link href="/login">Get Started Now <ArrowRight /></Link></p></div>
          <div><span><Radio /></span><p><b>Public Live Scores</b>Check scores from any match, any tournament.<Link href="/fixtures">View Live Scores <ArrowRight /></Link></p></div>
          <div className="landing-login-cta"><Link href="/login">Admin Login / Register <ArrowRight /></Link><Link href="/tournaments">Explore Tournaments <ArrowRight /></Link></div>
        </section>
      </main>
    </div>
  );
}

function FeatureMini({ icon: Icon, title, text }: { icon: typeof Zap; title: string; text: string }) {
  return <div><span><Icon /></span><p><b>{title}</b><small>{text}</small></p></div>;
}

function TeamCrest({ team }: { team?: Team }) {
  return <div className="landing-team-crest">{team?.logo_url ? <Image width={128} height={128} sizes="128px" src={team.logo_url} alt="" /> : <span>{team?.name.slice(0, 2).toUpperCase() || "CP"}</span>}<b>{team?.name || "Team"}</b></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <b className={`landing-status landing-status-${status}`}>{status}</b>;
}

function LandingStat({ icon: Icon, value, label }: { icon: typeof Trophy; value: string; label: string }) {
  return <div><Icon /><p><strong>{value}</strong><span>{label}</span></p></div>;
}

function formatDate(value: string | null) {
  if (!value) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function dateRange(start: string | null, end: string | null) {
  if (!start) return "Dates to be announced";
  return `${formatDate(start)}${end ? ` – ${formatDate(end)}` : ""}`;
}
