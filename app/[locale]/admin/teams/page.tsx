"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";
import { useAdminAccess } from "@/components/admin-shell";
import { useParams } from "next/navigation";
import { localePath } from "@/lib/locale-path";

type Team = Database['public']['Tables']['teams']['Row'] & { organizer_id?: string | null };

export default function TeamsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { isMasterAdmin, userId } = useAdminAccess();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchTeams() {
    let tournamentQuery = supabase.from("tournaments").select("*").is("deleted_at", null);
      if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
      const { data: manageable } = await tournamentQuery;
      const ids = (manageable || [] as Array<{ id: string }>).map((item: { id: string }) => item.id);
      const { data } = await supabase.from("teams").select("*").order("fixture_order", { ascending: true, nullsFirst: false }).order("name");
      if (data) setTeams(data.filter((team) => {
        if (team.tournament_id) return ids.includes(team.tournament_id);
        return isMasterAdmin || team.organizer_id === userId;
      }));
      setLoading(false);
    }
    fetchTeams();
  }, [isMasterAdmin, userId]);

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-themed-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">Manage all participating teams.</p>
        </div>
        <Link 
          href={localePath(locale, "/admin/teams/new")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Team
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search teams..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No teams found</h3>
            <p className="text-muted-foreground mt-1">Get started by adding your first team.</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">No. / Team Name</th>
                  <th className="px-6 py-3 font-medium">Scope</th>
                  <th className="px-6 py-3 font-medium">Owner</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      {team.fixture_order ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 font-black text-primary">{team.fixture_order}</span> : null}
                      {team.logo_url ? (
                        <Image unoptimized width={128} height={128} src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover bg-muted" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      {team.name}
                    </td>
                    <td className="px-6 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${team.tournament_id ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>{team.tournament_id ? "Tournament" : "Standalone"}</span></td>
                    <td className="px-6 py-4">{team.owner_name || "-"}</td>
                    <td className="px-6 py-4">{team.contact_number || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={localePath(locale, `/admin/teams/${team.id}`)}
                        className="text-primary hover:underline font-medium"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:hidden">
            {filteredTeams.map((team) => (
              <article key={team.id} className="min-w-0 rounded-xl border border-border bg-background/45 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {team.fixture_order ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">{team.fixture_order}</span> : null}
                  {team.logo_url ? <Image unoptimized width={128} height={128} src={team.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">{team.name.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-black leading-tight">{team.name}</h2>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${team.tournament_id ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>{team.tournament_id ? "Tournament" : "Standalone"}</span>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
                  <dt className="text-muted-foreground">Owner</dt><dd className="min-w-0 break-words font-semibold">{team.owner_name || "-"}</dd>
                  <dt className="text-muted-foreground">Contact</dt><dd className="min-w-0 break-all font-semibold">{team.contact_number || "-"}</dd>
                </dl>
                <Link href={localePath(locale, `/admin/teams/${team.id}`)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 font-bold text-primary-foreground">Manage Team</Link>
              </article>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
