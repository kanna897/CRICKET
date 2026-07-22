"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Play, ChevronRight, Bell, CalendarDays, FileText, Users, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { Database } from "@/types/database.types";
import { PublicNav } from "@/components/public-nav";
import { CRICKPULSE_SLOGAN, CrickpulseLogo } from "@/components/crickpulse-logo";

type Match = Database['public']['Tables']['matches']['Row'] & {
  team_a_id: string;
  team_b_id: string;
  teamA?: { name: string; logo_url: string | null } | null;
  teamB?: { name: string; logo_url: string | null } | null;
  tournament?: { name: string } | null;
};

type BallPayload = {
  runs?: number;
  is_wicket?: boolean;
  dismissal_type?: string | null;
};

// Notification Toast component
const NotificationToast = ({ message, onClose }: { message: string, onClose: () => void }) => (
  <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
    <Bell className="w-5 h-5 animate-bounce" />
    <span className="font-bold">{message}</span>
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">×</button>
  </div>
);

export default function PublicHome() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const publicLiveScoreHref = liveMatches[0] ? `/match/${liveMatches[0].id}` : "/fixtures";

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    // Fetch live matches
    const fetchLive = async () => {
      const { data } = await supabase
        .from('matches')
        .select(`
          *,
          teamA:teams!matches_team_a_id_fkey(name, logo_url),
          teamB:teams!matches_team_b_id_fkey(name, logo_url),
          tournament:tournaments(name)
        `)
        .eq('status', 'live');
      
      if (data) setLiveMatches(data);
    };

    fetchLive();

    // Subscribe to realtime matches changes
    const matchesChannel = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchLive();
      })
      .subscribe();

    // Subscribe to ball_by_ball for live events
    const ballChannel = supabase
      .channel('public:balls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ball_by_ball' }, payload => {
        const ball = payload.new as BallPayload;
        // Simple notification logic
        if (ball.runs === 6) showNotification("🔥 SIX! Maximum");
        else if (ball.runs === 4) showNotification("🏏 FOUR! Boundary scored");
        else if (ball.is_wicket) showNotification(`❌ WICKET! (${ball.dismissal_type || "out"})`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(ballChannel);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f9fc] text-slate-950">
      {notification && <NotificationToast message={notification} onClose={() => setNotification(null)} />}
      
      <PublicNav />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-7 sm:px-6 sm:py-10">
        {/* Hero Section */}
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#051a3e] via-[#0a3d73] to-[#0089b9] px-6 py-10 text-white shadow-[0_22px_60px_rgba(8,45,92,0.25)] sm:px-10 lg:px-14 lg:py-14">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="absolute -bottom-36 left-[38%] h-80 w-80 rounded-full bg-sky-300/15 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="relative grid items-center gap-9 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-extrabold tracking-[0.15em] text-sky-100"><Radio className="h-3.5 w-3.5 text-emerald-300" /> LIVE CRICKET EXPERIENCE</span></div>
              <h1 className="max-w-xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">Every ball.<br /><span className="text-emerald-300">Every moment.</span><br />One pulse.</h1>
              <p className="max-w-xl text-base leading-7 text-sky-100 sm:text-lg">Stay connected to your tournament with live scores, scorecards, team squads, player profiles and match posters—all without signing in.</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={publicLiveScoreHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-extrabold text-[#07355f] shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-50"><Play className="h-4 w-4 fill-current" /> Public Live Score</Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-5 py-3.5 font-extrabold text-white shadow-xl shadow-slate-950/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"><ShieldCheck className="h-4 w-4" /> Admin Login</Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm rounded-[1.65rem] border border-white/25 bg-slate-950/20 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              <div className="flex items-center justify-between"><span className="text-xs font-extrabold tracking-[0.2em] text-sky-100">CRICKPULSE</span><span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-[10px] font-black tracking-widest text-rose-100"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />LIVE</span></div>
              <div className="my-6 flex flex-col items-center justify-center gap-2.5">
                <CrickpulseLogo className="h-20 w-64 rounded-xl bg-white p-2.5 object-contain shadow-lg" />
                <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-sky-100 sm:text-xs">{CRICKPULSE_SLOGAN}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Public portal</p><div className="mt-3 flex items-center justify-between text-sm font-bold"><span>Live score</span><span className="text-emerald-300">Real time</span></div><div className="mt-2 flex items-center justify-between text-sm font-bold"><span>Scorecards</span><span className="text-emerald-300">View only</span></div><div className="mt-2 flex items-center justify-between text-sm font-bold"><span>Match poster</span><span className="text-emerald-300">Download</span></div></div>
            </div>
          </div>
        </section>

        <section id="public-features" aria-label="Public cricket features" className="grid scroll-mt-24 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/fixtures" className="group rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,69,110,0.07)] transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl">
            <span className="mb-4 inline-flex rounded-xl bg-sky-50 p-3 text-sky-600"><CalendarDays className="h-6 w-6" /></span>
            <h2 className="font-extrabold text-slate-900">Fixtures</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">Browse live, upcoming and completed matches.</p>
          </Link>
          <Link href="/points" className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,69,110,0.07)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
            <span className="mb-4 inline-flex rounded-xl bg-emerald-50 p-3 text-emerald-600"><ChevronRight className="h-6 w-6" /></span>
            <h2 className="font-extrabold text-slate-900">Points table</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">See rankings, wins, losses and net run rate.</p>
          </Link>
          <Link href="/teams" className="group rounded-2xl border border-indigo-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,69,110,0.07)] transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl">
            <span className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600"><Users className="h-6 w-6" /></span>
            <h2 className="font-extrabold text-slate-900">Teams & squads</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">View squads and open each player&apos;s profile card.</p>
          </Link>
          <Link href="/fixtures" className="group rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,69,110,0.07)] transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl">
            <span className="mb-4 inline-flex rounded-xl bg-amber-50 p-3 text-amber-600"><FileText className="h-6 w-6" /></span>
            <h2 className="font-extrabold text-slate-900">Scorecard & summary</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">Review scorecards and download the match-summary poster.</p>
          </Link>
        </section>

        {/* Live Matches Section */}
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,69,110,0.08)] sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div><p className="mb-1 flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-sky-600"><Sparkles className="h-3.5 w-3.5" /> MATCH CENTRE</p><h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
              <span className="relative mr-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Matches</h2></div>
            <Link href="/fixtures" className="inline-flex items-center rounded-lg bg-sky-50 px-3 py-2 text-sm font-extrabold text-sky-700 transition hover:bg-sky-100">
              All Fixtures <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {liveMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-9 text-center text-slate-500">
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-sky-500" />
              No live matches at the moment. Check fixtures for upcoming games.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveMatches.map(match => (
                <div key={match.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400"></div>
                  <div className="mb-5 flex items-center justify-between gap-3"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{match.tournament?.name}</p><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black tracking-widest text-rose-600">LIVE</span></div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {match.teamA?.logo_url ? <img src={match.teamA.logo_url} alt="" className="w-8 h-8 rounded-full bg-muted" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                        <span className="font-bold">{match.teamA?.name}</span>
                      </div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600">Batting</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {match.teamB?.logo_url ? <img src={match.teamB.logo_url} alt="" className="w-8 h-8 rounded-full bg-muted" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                        <span className="font-bold">{match.teamB?.name}</span>
                      </div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Fielding</span>
                    </div>
                  </div>
                  
                  {match.toss_decision && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                      <span className="font-bold text-slate-800">Toss: </span>
                      <span className="text-slate-500">{match.toss_winner_id === match.team_a_id ? match.teamA?.name : match.teamB?.name} won the toss and elected to {match.toss_decision.toLowerCase()}.</span>
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-500">Follow live coverage</span>
                    <Link href={`/match/${match.id}`} aria-label={`Open ${match.teamA?.name} versus ${match.teamB?.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700 transition group-hover:bg-sky-600 group-hover:text-white">
                      <Play className="w-4 h-4 ml-0.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
