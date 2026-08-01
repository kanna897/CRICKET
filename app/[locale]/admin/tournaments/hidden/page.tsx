"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAdminAccess } from "@/components/admin-shell";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
type HideAudit = { entity_id: string; user_id: string | null; created_at: string };

export default function HiddenTournamentsPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [audits, setAudits] = useState<Map<string, HideAudit>>(new Map());

  const load = useCallback(async () => {
    let query = supabase.from("tournaments").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    if (!isMasterAdmin) query = query.eq("organizer_id", userId);
    const [{ data, error }, auditResult] = await Promise.all([
      query,
      supabase.from("audit_logs").select("entity_id,user_id,created_at").eq("action", "Tournament Hidden").order("created_at", { ascending: false }).limit(200),
    ]);
    if (error) alert(error.message);
    setRows(data ?? []);
    const latest = new Map<string, HideAudit>();
    for (const audit of (auditResult.data ?? []) as HideAudit[]) if (!latest.has(audit.entity_id)) latest.set(audit.entity_id, audit);
    setAudits(latest);
    setLoading(false);
  }, [isMasterAdmin, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function unhide(tournament: Tournament) {
    if (!confirm("Unhide this tournament?\n\nThe tournament and all related preserved data will become visible again.")) return;
    setWorkingId(tournament.id);
    const { data, error } = await supabase.rpc("unhide_tournament", { p_tournament_id: tournament.id });
    setWorkingId(null);
    if (error) return alert(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) return alert("Tournament could not be unhidden.");
    await load();
  }

  return <div className="admin-themed-page space-y-6">
    <div><Link href="/admin/tournaments" className="inline-flex items-center font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4"/>Active Tournaments</Link><h1 className="mt-4 text-3xl font-bold">Hidden Tournaments</h1><p className="mt-1 text-muted-foreground">Hidden tournaments retain every team, player relationship, match, score and registration.</p></div>
    <section className="rounded-xl border border-border bg-card p-6">
      {loading ? <p>Loading hidden tournaments…</p> : rows.length===0 ? <div className="py-12 text-center"><EyeOff className="mx-auto h-10 w-10 text-muted-foreground"/><h2 className="mt-3 text-lg font-bold">No hidden tournaments</h2></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3">Tournament</th><th className="p-3">Hidden date</th><th className="p-3">Hidden by</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{rows.map((tournament)=>{const audit=audits.get(tournament.id);return <tr key={tournament.id} className="border-b border-border"><td className="p-3 font-bold">{tournament.name}</td><td className="p-3">{tournament.deleted_at?new Intl.DateTimeFormat("en",{dateStyle:"medium",timeStyle:"short"}).format(new Date(tournament.deleted_at)):"-"}</td><td className="p-3 font-mono text-xs">{audit?.user_id?audit.user_id.slice(0,8):"Not available"}</td><td className="p-3 text-right"><button type="button" disabled={workingId===tournament.id} onClick={()=>void unhide(tournament)} className="inline-flex items-center font-semibold text-emerald-600 disabled:opacity-50"><Eye className="mr-2 h-4 w-4"/>{workingId===tournament.id?"Unhiding…":"Unhide Tournament"}</button></td></tr>})}</tbody></table></div>}
    </section>
  </div>;
}
