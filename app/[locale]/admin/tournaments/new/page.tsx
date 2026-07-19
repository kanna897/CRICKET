"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { uploadImage } from "@/lib/media";

const tournamentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  venue: z.string().min(3, "Venue is required"),
  start_date: z.string().min(1, "Start date is required"),
  ball_type: z.string().min(1, "Ball type is required"),
  overs: z.number().min(1).max(50),
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

export default function NewTournamentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      overs: 20,
      ball_type: "Tennis",
    }
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: TournamentFormValues) => {
    setIsSubmitting(true);
    try {
      let logo_url = null;

      // Upload logo if exists
      if (logoFile) {
        const { url } = await uploadImage(logoFile, "tournament-logos");
        logo_url = url;
      }

      // Insert Tournament
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('tournaments') as any)
        .insert([
          {
            name: data.name,
            tournament_name: data.name,
            venue: data.venue,
            start_date: data.start_date,
            end_date: data.start_date,
            ball_type: data.ball_type,
            overs: data.overs,
            overs_per_match: data.overs,
            logo_url,
            status: 'upcoming'
          }
        ]);

      if (insertError) throw insertError;

      router.push('/admin/tournaments');
      router.refresh();
    } catch (error) {
      console.error("Error creating tournament:", error);
      alert("Failed to create tournament. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tournaments" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Tournament</h1>
          <p className="text-muted-foreground mt-1">Setup a new cricket tournament</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Logo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tournament Logo</label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <Trophy className="w-8 h-8 text-muted-foreground" />
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
              <label className="text-sm font-medium">Tournament Name <span className="text-red-500">*</span></label>
              <input 
                {...register("name")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Summer Premier League 2026"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Venue <span className="text-red-500">*</span></label>
              <input 
                {...register("venue")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Central Stadium"
              />
              {errors.venue && <p className="text-sm text-red-500">{errors.venue.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date <span className="text-red-500">*</span></label>
              <input 
                type="date"
                {...register("start_date")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.start_date && <p className="text-sm text-red-500">{errors.start_date.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ball Type</label>
              <select 
                {...register("ball_type")}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Tennis">Tennis Ball</option>
                <option value="Leather">Leather Ball</option>
                <option value="Tape">Tape Ball</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Overs per Innings <span className="text-red-500">*</span></label>
              <input 
                type="number"
                {...register("overs", { valueAsNumber: true })}
                className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                max="50"
              />
              {errors.overs && <p className="text-sm text-red-500">{errors.overs.message}</p>}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
            <Link 
              href="/admin/tournaments"
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
              Create Tournament
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
