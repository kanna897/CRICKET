"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, ImagePlus, Upload, Loader2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { uploadImage } from "@/lib/media";
import { useAdminAccess } from "@/components/admin-shell";

const tournamentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  venue: z.string().min(3, "Venue is required"),
  start_date: z.string().min(1, "Start date is required"),
  ball_type: z.string().min(1, "Ball type is required"),
  overs: z.number().min(1).max(50),
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;
type PendingTemplate = { id: string; file: File; preview: string; visible: boolean };

export default function NewTournamentPage() {
  const { userId } = useAdminAccess();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [cardTemplates, setCardTemplates] = useState<PendingTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState("");

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

  const handleTemplateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      visible: true,
    }));
    setCardTemplates((current) => [...current, ...next]);
    setActiveTemplateId((current) => current || next[0].id);
    event.target.value = "";
  };

  const toggleTemplate = (id: string) => {
    setCardTemplates((current) => current.map((template) => template.id === id ? { ...template, visible: !template.visible } : template));
    if (activeTemplateId === id) setActiveTemplateId("");
  };

  const removeTemplate = (id: string) => {
    const target = cardTemplates.find((template) => template.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    setCardTemplates((current) => current.filter((template) => template.id !== id));
    if (activeTemplateId === id) setActiveTemplateId("");
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
      const { data: createdTournament, error: insertError } = await (supabase.from('tournaments') as any)
        .insert([
          {
            name: data.name,
            organizer_id: userId,
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
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;

      let selectedTemplateId: string | null = null;
      for (const template of cardTemplates) {
        const uploaded = await uploadImage(template.file, "auction-templates");
        const { data: createdTemplate, error: templateError } = await (supabase.from("card_templates") as any)
          .insert({
            organizer_id: userId,
            name: template.file.name.replace(/\.[^.]+$/, "").trim() || "Player card template",
            template_type: "player",
            image_url: uploaded.url,
            public_id: uploaded.publicId,
            is_visible: template.visible,
          })
          .select("id")
          .single();
        if (templateError) throw templateError;
        if (template.id === activeTemplateId && template.visible) selectedTemplateId = createdTemplate.id;
      }
      if (selectedTemplateId) {
        const { error: choiceError } = await (supabase.from("tournament_card_templates") as any).insert({
          tournament_id: createdTournament.id,
          player_template_id: selectedTemplateId,
        });
        if (choiceError) throw choiceError;
      }

      router.push(`/admin/tournaments/${createdTournament.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating tournament:", error);
      alert("Failed to create tournament. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-themed-page max-w-3xl mx-auto space-y-6">
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

          <section className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Player Card Templates</p>
                <h2 className="mt-1 text-lg font-black">Upload registration card designs</h2>
                <p className="mt-1 text-sm text-muted-foreground">The selected visible template automatically generates every registered player card for this tournament.</p>
              </div>
              <label className="control cursor-pointer bg-primary text-primary-foreground">
                <ImagePlus className="mr-2 h-4 w-4" />Upload Templates
                <input type="file" multiple accept="image/jpeg,image/png" className="sr-only" onChange={handleTemplateChange} />
              </label>
            </div>
            {!cardTemplates.length ? (
              <div className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-border text-center text-sm text-muted-foreground">
                <span><Upload className="mx-auto mb-2 h-6 w-6" />Upload one or more JPG/PNG player-card templates.</span>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {cardTemplates.map((template) => {
                  const active = activeTemplateId === template.id;
                  return <article key={template.id} className={`overflow-hidden rounded-2xl border bg-card ${active ? "border-emerald-500 ring-2 ring-emerald-200" : "border-border"} ${template.visible ? "" : "opacity-60"}`}>
                    <button type="button" disabled={!template.visible} onClick={() => setActiveTemplateId(template.id)} className="relative block aspect-square w-full overflow-hidden bg-black/5 text-left">
                      <img src={template.preview} alt={template.file.name} className="h-full w-full object-cover" />
                      {active && <span className="absolute right-3 top-3 rounded-full bg-emerald-600 p-2 text-white"><CheckCircle2 className="h-5 w-5" /></span>}
                    </button>
                    <div className="space-y-3 p-3">
                      <p className="truncate text-sm font-black">{template.file.name}</p>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <button type="button" onClick={() => toggleTemplate(template.id)} className="control justify-center">
                          {template.visible ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                          {template.visible ? "Visible · Hide" : "Hidden · Show"}
                        </button>
                        <button type="button" aria-label="Remove template" onClick={() => removeTemplate(template.id)} className="control px-3 text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                      {template.visible && !active && <button type="button" onClick={() => setActiveTemplateId(template.id)} className="w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-black text-primary">Use for this tournament</button>}
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>

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
