"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { Database } from "@/types/database.types";
import { uploadImage } from "@/lib/media";
import { useAdminAccess } from "@/components/admin-shell";
import { useParams } from "next/navigation";
import { localePath } from "@/lib/locale-path";

type Tournament = Database['public']['Tables']['tournaments']['Row'];

const teamSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  tournament_id: z.string().optional(),
  owner_name: z.string().optional(),
  contact_number: z.string().optional(),
});

type TeamFormValues = z.infer<typeof teamSchema>;

export default function NewTeamPage() {
  const { locale } = useParams<{ locale: string }>();
  const { isMasterAdmin, userId } = useAdminAccess();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema)
  });

  useEffect(() => {
    async function fetchTournaments() {
      let query = supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (!isMasterAdmin) query = query.eq('organizer_id', userId);
      const { data } = await query;
      if (data) {
        const tournamentRows = data as unknown as Tournament[];
        setTournaments(tournamentRows);
        const requestedTournament = new URLSearchParams(window.location.search).get("tournament");
        if (tournamentRows.some((tournament) => tournament.id === requestedTournament)) setValue("tournament_id", requestedTournament!);
      }
    }
    fetchTournaments();
  }, [isMasterAdmin, userId, setValue]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: TeamFormValues) => {
    setIsSubmitting(true);
    try {
      // Validation to prevent duplicate team names within the same tournament
      let duplicateQuery = supabase
        .from('teams')
        .select('id')
        .eq('name', data.name);
      duplicateQuery = data.tournament_id
        ? duplicateQuery.eq('tournament_id', data.tournament_id)
        : duplicateQuery.is('tournament_id', null).eq('organizer_id', userId);
      const { data: existingTeam } = await duplicateQuery.maybeSingle();
        
      if (existingTeam) {
        alert(data.tournament_id ? "A team with this name already exists in the selected tournament." : "You already have a standalone team with this name.");
        setIsSubmitting(false);
        return;
      }

      let logo_url = null;

      if (logoFile) {
        const { url } = await uploadImage(logoFile, "team-logos");
        logo_url = url;
      }

       
      const { error: insertError } = await supabase.from('teams')
        .insert([
          {
            name: data.name,
            // The live database also retains these legacy fields. Writing both
            // names keeps old reports compatible while the app uses `name`.
            team_name: data.name,
            tournament_id: data.tournament_id || null,
            organizer_id: userId,
            owner_name: data.owner_name,
            contact_number: data.contact_number,
            owner_phone: data.contact_number,
            logo_url,
          }
        ]);

      if (insertError) throw insertError;

      router.push(localePath(locale, '/admin/teams'));
      router.refresh();
    } catch (error) {
      console.error("Error creating team:", error);
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      alert(`Failed to create team: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="match-theme-surface relative mx-auto max-w-4xl space-y-6 overflow-hidden rounded-[2rem] border border-amber-200/30 bg-[radial-gradient(circle_at_top_right,#1c62ba_0%,#0a1f4a_46%,#050b26_100%)] p-4 pb-8 text-white shadow-2xl sm:p-7">
      <div className="pointer-events-none absolute -left-24 top-44 h-2 w-[32rem] -rotate-12 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent blur-sm" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-2 w-[32rem] -rotate-12 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent blur-sm" />
      <div className="relative flex items-center gap-4">
        <Link href={localePath(locale, "/admin/teams")} aria-label="Back to teams" className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-primary transition hover:-translate-x-0.5 hover:bg-white/15 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Team setup</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Create Team</h1>
          <p className="mt-1 text-sm text-slate-300">Register a tournament team or a reusable standalone team</p>
        </div>
      </div>

      <div className="match-theme-adaptive-card relative overflow-hidden rounded-3xl border border-amber-200/30 bg-[#06122d]/95 shadow-xl shadow-black/25">
        <div className="h-1 bg-gradient-to-r from-[#e7b84d] via-[#fff2a8] to-cyan-300" />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="border-b border-white/10 bg-gradient-to-r from-[#0d4e9c]/45 to-transparent p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Team identity</p>
            <h2 className="mt-1 text-lg font-bold">Logo and branding</h2>
            <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-dashed border-cyan-200/45 bg-cyan-300/10 shadow-inner">
                {logoPreview ? (
                  <Image src={logoPreview} alt="Logo preview" fill sizes="112px" unoptimized className="object-cover" />
                ) : (
                  <Shield className="h-10 w-10 text-cyan-200" />
                )}
              </div>
              <div>
                <input 
                  type="file" 
                  id="logo-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLogoChange}
                />
                <label 
                  htmlFor="logo-upload" 
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-cyan-200/40 bg-cyan-300/10 px-4 text-sm font-semibold text-primary transition hover:bg-cyan-300/20"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </label>
                <p className="mt-2 text-xs text-slate-400">Recommended: 400×400px JPG or PNG</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 px-6 sm:px-7 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-100">Team Name <span className="text-red-500">*</span></label>
              <input 
                {...register("name")}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0a1f4a] px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="e.g. Royal Challengers"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-100">Tournament <span className="text-slate-400">(optional)</span></label>
              <select 
                {...register("tournament_id")}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0a1f4a] px-4 text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
              >
                <option value="">Standalone team (no tournament)</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">Leave this empty for friendly, school, club or practice matches.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-100">Owner Name</label>
              <input 
                {...register("owner_name")}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0a1f4a] px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-100">Contact Number</label>
              <input 
                {...register("contact_number")}
                className="h-11 w-full rounded-xl border border-white/15 bg-[#0a1f4a] px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="e.g. +1234567890"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 px-6 py-6 sm:flex-row sm:px-7">
            <Link 
              href={localePath(locale, "/admin/teams")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Link>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#c88e1a] via-[#f7d56b] to-[#c88e1a] px-6 text-sm font-black text-[#06122d] shadow-lg shadow-amber-500/15 transition hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
