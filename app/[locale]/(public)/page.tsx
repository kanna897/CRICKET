"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Play, Trophy, ChevronRight, Bell } from "lucide-react";
import { Database } from "@/types/database.types";

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
    <div className="min-h-screen bg-background">
      {notification && <NotificationToast message={notification} onClose={() => setNotification(null)} />}
      
      {/* Public Navbar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            <span className="font-black text-xl tracking-tight text-foreground">CRICKPULSE</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-primary">Home</Link>
            <Link href="/fixtures" className="text-muted-foreground hover:text-foreground transition-colors">Fixtures</Link>
            <Link href="/teams" className="text-muted-foreground hover:text-foreground transition-colors">Teams</Link>
            <Link href="/points" className="text-muted-foreground hover:text-foreground transition-colors">Points Table</Link>
            <Link href="/stats" className="text-muted-foreground hover:text-foreground transition-colors">Stats</Link>
          </nav>
          <Link href="/admin" className="text-sm font-medium bg-primary/10 text-primary px-4 py-2 rounded-full hover:bg-primary/20 transition-colors">
            Admin Portal
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2067&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-semibold tracking-wider">ENTERPRISE CRICKET PLATFORM</span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
              Experience the pulse of live cricket.
            </h1>
            <p className="text-lg text-primary-foreground/80 max-w-xl">
              Real-time scores, comprehensive statistics, and dynamic match tracking for the ultimate tournament experience.
            </p>
          </div>
        </section>

        {/* Live Matches Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="relative flex h-3 w-3 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Matches
            </h2>
            <Link href="/fixtures" className="text-sm text-primary hover:underline flex items-center">
              All Fixtures <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {liveMatches.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
              No live matches at the moment. Check fixtures for upcoming games.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveMatches.map(match => (
                <div key={match.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600"></div>
                  <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider font-semibold">{match.tournament?.name}</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {match.teamA?.logo_url ? <img src={match.teamA.logo_url} alt="" className="w-8 h-8 rounded-full bg-muted" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                        <span className="font-bold">{match.teamA?.name}</span>
                      </div>
                      <span className="font-black text-xl tabular-nums">145/4</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {match.teamB?.logo_url ? <img src={match.teamB.logo_url} alt="" className="w-8 h-8 rounded-full bg-muted" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                        <span className="font-bold">{match.teamB?.name}</span>
                      </div>
                      <span className="font-black text-xl tabular-nums text-muted-foreground">112/8</span>
                    </div>
                  </div>
                  
                  {match.toss_decision && (
                    <div className="mt-4 p-3 bg-muted rounded-lg border border-border/50 text-sm">
                      <span className="font-semibold text-foreground">Toss: </span>
                      <span className="text-muted-foreground">{match.toss_winner_id === match.team_a_id ? match.teamA?.name : match.teamB?.name} won the toss and elected to {match.toss_decision.toLowerCase()}.</span>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                    <span className="text-sm font-medium text-red-500">Team A needs 34 runs in 12 balls</span>
                    <Link href={`/match/${match.id}`} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
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
