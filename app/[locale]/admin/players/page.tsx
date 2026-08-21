"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Search, User, Upload, Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";
import Papa from "papaparse";
import { useAdminAccess } from "@/components/admin-shell";
import { rowsToCsv } from "@/lib/csv";

type Player = Database['public']['Tables']['players']['Row'];
const PLAYERS_PER_PAGE = 20;

export default function PlayersPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    if (isMasterAdmin) {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) console.error("Failed to load players:", error);
      setPlayers(data || []);
      setLoading(false);
      return;
    }

    let tournamentQuery = supabase.from("tournaments").select("*").is("deleted_at", null);
    tournamentQuery = tournamentQuery.eq("organizer_id", userId);
    const { data: tournaments } = await tournamentQuery;
    const tournamentIds = (tournaments || [] as Array<{ id: string }>).map((item: { id: string }) => item.id);
    const { data: teams } = await supabase.from("teams").select("id,tournament_id,organizer_id");
    const teamIds = ((teams || []) as Array<{ id: string; tournament_id: string | null; organizer_id: string | null }>)
      .filter((team) => isMasterAdmin || tournamentIds.includes(team.tournament_id || "") || team.organizer_id === userId)
      .map((team) => team.id);
    const { data } = teamIds.length ? await supabase.from("players").select("*").in("team_id", teamIds).order("created_at", { ascending: false }) : { data: [] };

    if (data) setPlayers(data);
    setLoading(false);
  }, [isMasterAdmin, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPlayers(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchPlayers]);

  const handleDownloadTemplate = () => {
    const csv = rowsToCsv(
      ["Player Name", "Phone Number", "Playing Role"],
      [["John Doe", "+94771234567", "Batsman"]],
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "crickpulse_player_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        let jsonData: Record<string, string>[] = [];
        
        const text = evt.target?.result as string;
        jsonData = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;

        if (jsonData.length === 0) {
          alert("File is empty or invalid format.");
          setIsImporting(false);
          return;
        }

        let importedCount = 0;
        let duplicateCount = 0;
        const failedRows: string[] = [];

        // Process data
        for (const row of jsonData) {
          const name = row['Player Name'] || row['name'] || row['Name'];
          const phone = row['Phone Number'] || row['phone_number'] || row['Phone'];
          const role = row['Playing Role'] || row['playing_role'] || row['Role'] || 'Batsman';

          if (!name || !phone) {
            failedRows.push(name || phone || "Unnamed row");
            continue;
          }

          // Check if player exists by phone number (Duplicate prevention as per BRD)
          const { data: existingPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('phone_number', String(phone).trim())
            .single();

          if (!existingPlayer) {
            // Create new player
            const { error: insertError } = await supabase.from('players').insert([{
              name: String(name).trim(),
              player_name: String(name).trim(),
              phone_number: String(phone).trim(),
              playing_role: String(role).trim(),
              role: String(role).trim().toLowerCase(),
            }]);

            if (insertError) {
              console.error("Player import failed:", { name, error: insertError });
              failedRows.push(String(name));
            } else {
              importedCount += 1;
            }
          } else {
            duplicateCount += 1;
          }
          // If player exists, we just skip creating a new one as per BRD ("reuse existing profile")
          // Logic for linking to a specific tournament/team can be handled in the Team Squad management.
        }

        await fetchPlayers();

        if (failedRows.length > 0) {
          alert(`Imported ${importedCount} player${importedCount === 1 ? "" : "s"}. ${failedRows.length} row${failedRows.length === 1 ? "" : "s"} failed: ${failedRows.join(", ")}`);
        } else {
          alert(`Import complete: ${importedCount} added, ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped.`);
        }
      } catch (err) {
        console.error("Import error:", err);
        alert("An error occurred during import.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone_number?.includes(search)
  );
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PLAYERS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const firstPlayerIndex = (activePage - 1) * PLAYERS_PER_PAGE;
  const visiblePlayers = filteredPlayers.slice(firstPlayerIndex, firstPlayerIndex + PLAYERS_PER_PAGE);

  return (
    <div className="admin-themed-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-muted-foreground mt-1">Manage global player directory.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv,text/csv"
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Bulk Import
          </button>
          <Link 
            href="/admin/players/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Player
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button 
            onClick={handleDownloadTemplate}
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            <Download className="w-4 h-4 mr-1" />
            Download Import Template
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No players found</h3>
            <p className="text-muted-foreground mt-1">Get started by importing or adding a player.</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Player</th>
                  <th className="px-6 py-3 font-medium">Phone Number</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      {player.photo_url ? (
                        <Image unoptimized width={128} height={128} src={player.photo_url} alt="" className="w-8 h-8 rounded-full object-cover bg-muted" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div>{player.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">ID: {player.id.substring(0,8)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono">{player.phone_number}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                        {player.playing_role || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/players/${player.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:hidden">
            {visiblePlayers.map((player) => (
              <article key={player.id} className="min-w-0 rounded-xl border border-border bg-background/45 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {player.photo_url ? <Image unoptimized width={128} height={128} src={player.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">{player.name.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-black leading-tight">{player.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {player.id.substring(0, 8)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">{player.playing_role || "Unknown"}</span>
                </div>
                <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="min-w-0 break-all font-mono text-sm">{player.phone_number || "No phone"}</p>
                  <Link href={`/admin/players/${player.id}`} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Profile</Link>
                </div>
              </article>
            ))}
          </div>
          <nav className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Player directory pagination">
            <p className="text-sm text-muted-foreground">
              Showing {firstPlayerIndex + 1}-{Math.min(firstPlayerIndex + PLAYERS_PER_PAGE, filteredPlayers.length)} of {filteredPlayers.length} players
            </p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={activePage === 1}
                className="rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-medium tabular-nums" aria-current="page">
                Page {activePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={activePage === totalPages}
                className="rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </nav>
          </>
        )}
      </div>
    </div>
  );
}
