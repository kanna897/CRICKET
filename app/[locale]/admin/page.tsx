"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Users, PlayCircle, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const data = [
  { name: "Mon", matches: 4 },
  { name: "Tue", matches: 3 },
  { name: "Wed", matches: 5 },
  { name: "Thu", matches: 2 },
  { name: "Fri", matches: 6 },
  { name: "Sat", matches: 12 },
  { name: "Sun", matches: 10 },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    tournaments: 0,
    teams: 0,
    matches: 0,
    players: 0
  });

  useEffect(() => {
    async function loadStats() {
      const [tData, teamData, mData, pData] = await Promise.all([
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('teams').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('matches').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('players').select('*', { count: 'exact', head: true }).is('deleted_at', null)
      ]);

      setStats({
        tournaments: tData.count || 0,
        teams: teamData.count || 0,
        matches: mData.count || 0,
        players: pData.count || 0
      });
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your tournament ecosystem.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tournaments</p>
              <h3 className="text-3xl font-bold mt-2">{stats.tournaments}</h3>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Teams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.teams}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matches Played</p>
              <h3 className="text-3xl font-bold mt-2">{stats.matches}</h3>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
              <PlayCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Registered Players</p>
              <h3 className="text-3xl font-bold mt-2">{stats.players}</h3>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Matches This Week</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'rgba(24, 24, 27, 0.05)' }}
                />
                <Bar dataKey="matches" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/admin/tournaments/new" className="block w-full py-3 px-4 bg-primary text-primary-foreground text-center rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Create New Tournament
            </Link>
            <Link href="/admin/teams/new" className="block w-full py-3 px-4 border border-border text-center rounded-lg font-medium hover:bg-muted transition-colors">
              Add New Team
            </Link>
            <Link href="/admin/matches/new" className="block w-full py-3 px-4 border border-border text-center rounded-lg font-medium hover:bg-muted transition-colors">
              Start a Match
            </Link>
            <Link href="/admin/players/import" className="block w-full py-3 px-4 border border-border text-center rounded-lg font-medium hover:bg-muted transition-colors">
              Bulk Import Players
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
