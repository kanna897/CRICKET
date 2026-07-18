"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { Database } from "@/types/database.types";

type Tournament = Database['public']['Tables']['tournaments']['Row'];

const teamSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  tournament_id: z.string().min(1, "Tournament selection is required"),
  owner_name: z.string().optional(),
  contact_number: z.string().optional(),
});

type TeamFormValues = z.infer<typeof teamSchema>;

export default function NewTeamPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema)
  });

  useEffect(() => {
    async function fetchTournaments() {
      const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (data) setTournaments(data);
    }
    fetchTournaments();
  }, []);

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
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('tournament_id', data.tournament_id)
        .eq('name', data.name)
        .single();
        
      if (existingTeam) {
        alert("A team with this name already exists in the selected tournament.");
        setIsSubmitting(false);
        return;
      }

      let logo_url = null;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        // eslint-disable-next-line react-hooks/purity
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
          
        logo_url = publicUrlData.publicUrl;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('teams') as any)
        .insert([
          {
            name: data.name,
            tournament_id: data.tournament_id,
            owner_name: data.owner_name,
            contact_number: data.contact_number,
            logo_url,
          }
        ]);

      if (insertError) throw insertError;

      router.push('/admin/teams');
      router.refresh();
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/teams" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Team</h1>
          <p className="text-muted-foreground mt-1">Register a new team for a tournament</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Team Logo</label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <Shield className="w-8 h-8 text-muted-foreground" />
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
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </label>
                <p className="text-xs text-muted-foreground mt-2">Recommended: 400x400px JPG or PNG</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Name <span className="text-red-500">*</span></label>
              <input 
                {...register("name")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Royal Challengers"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tournament <span className="text-red-500">*</span></label>
              <select 
                {...register("tournament_id")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a tournament...</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {errors.tournament_id && <p className="text-sm text-red-500">{errors.tournament_id.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Owner Name</label>
              <input 
                {...register("owner_name")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Number</label>
              <input 
                {...register("contact_number")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. +1234567890"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
            <Link 
              href="/admin/teams"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Cancel
            </Link>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50"
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
