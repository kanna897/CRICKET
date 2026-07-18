"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Trophy, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";

type Tournament = Database['public']['Tables']['tournaments']['Row'];

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showTrash, setShowTrash] = useState(false);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("tournaments").select("*").order("created_at", { ascending: false });
    
    if (showTrash) {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    const { data } = await query;
    if (data) setTournaments(data);
    setLoading(false);
  }, [showTrash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournaments();
  }, [fetchTournaments]);

  const handleSoftDelete = async (id: string) => {
    if (!confirm("Are you sure you want to move this tournament to the trash?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("tournaments") as any).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    fetchTournaments();
  };

  const handleRestore = async (id: string) => {
    if (!confirm("Restore this tournament?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("tournaments") as any).update({ deleted_at: null }).eq("id", id);
    fetchTournaments();
  };

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-muted-foreground mt-1">Manage your cricket tournaments here.</p>
        </div>
        <Link 
          href="/admin/tournaments/new"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Tournament
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search tournaments..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border transition-colors ${showTrash ? 'bg-red-50 text-red-600 border-red-200' : 'bg-background border-input hover:bg-muted'}`}
          >
            <Trash2 className="w-4 h-4" />
            {showTrash ? "View Active" : "View Trash"}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No tournaments found</h3>
            <p className="text-muted-foreground mt-1">Get started by creating your first tournament.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Tournament</th>
                  <th className="px-6 py-3 font-medium">Venue</th>
                  <th className="px-6 py-3 font-medium">Start Date</th>
                  <th className="px-6 py-3 font-medium">Overs</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTournaments.map((tournament) => (
                  <tr key={tournament.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      {tournament.logo_url ? (
                        <img src={tournament.logo_url} alt={`${tournament.name} logo`} className="w-8 h-8 rounded-full object-cover bg-muted" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {tournament.name.charAt(0)}
                        </div>
                      )}
                      {tournament.name}
                    </td>
                    <td className="px-6 py-4">{tournament.venue || "-"}</td>
                    <td className="px-6 py-4">{tournament.start_date || "-"}</td>
                    <td className="px-6 py-4">{tournament.overs}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tournament.status === 'upcoming' ? 'bg-blue-500/10 text-blue-500' :
                        tournament.status === 'ongoing' ? 'bg-green-500/10 text-green-500' :
                        'bg-gray-500/10 text-gray-500'
                      }`}>
                        {tournament.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                      {!showTrash ? (
                        <>
                          <Link 
                            href={`/admin/tournaments/${tournament.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            Manage
                          </Link>
                          <button 
                            onClick={() => handleSoftDelete(tournament.id)}
                            className="text-red-500 hover:text-red-600 p-1"
                            title="Move to trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleRestore(tournament.id)}
                          className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
                        >
                          <RotateCcw className="w-4 h-4" /> Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
