"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Loader2, Upload, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";
import { uploadImage } from "@/lib/media";
import { useParams } from "next/navigation";
import { localePath } from "@/lib/locale-path";

type Team = Database["public"]["Tables"]["teams"]["Row"];

const playerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone_number: z.string().trim().min(5, "Enter a valid phone number"),
  playing_role: z.string().min(1, "Select a playing role"),
  team_id: z.string().optional(),
  batting_style: z.string().optional(),
  bowling_style: z.string().optional(),
});

type PlayerFormValues = z.infer<typeof playerSchema>;

export default function NewPlayerPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState("/admin/players");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerSchema),
    defaultValues: { playing_role: "Batsman" },
  });

  useEffect(() => {
    async function loadTeams() {
      const { data } = await supabase.from("teams").select("*").order("name");
      if (data) {
        const teamRows = data as unknown as Team[];
        setTeams(teamRows);
        const requestedTeam = new URLSearchParams(window.location.search).get("team");
        const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
        if (requestedTeam && teamRows.some((team) => team.id === requestedTeam)) setValue("team_id", requestedTeam);
        if (requestedReturn?.startsWith("/admin/")) setReturnPath(requestedReturn);
      }
    }
    loadTeams();
  }, [setValue]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (data: PlayerFormValues) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const { data: existingPlayer, error: lookupError } = await supabase
        .from("players")
        .select("id")
        .eq("phone_number", data.phone_number)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (existingPlayer) {
        alert("A player with this phone number already exists.");
        return;
      }

      let photo_url: string | null = null;
      if (photoFile) {
        ({ url: photo_url } = await uploadImage(photoFile, "player-photos"));
      }

      const payload = {
        name: data.name,
        player_name: data.name,
        phone_number: data.phone_number,
        contact_number: data.phone_number,
        playing_role: data.playing_role,
        // Legacy `role` has a lowercase check constraint in the live database.
        role: data.playing_role.toLowerCase(),
        team_id: data.team_id || null,
        batting_style: data.batting_style || null,
        bowling_style: data.bowling_style || null,
        photo_url,
      };

      // The database retains legacy column names while the UI uses the new names.
      const { error } = await supabase.from("players").insert(payload);
      if (error) throw error;

      router.push(localePath(locale, returnPath));
      router.refresh();
    } catch (error) {
      console.error("Error creating player:", error);
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "An unexpected error occurred.";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-themed-page max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={localePath(locale, returnPath)} className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Player</h1>
          <p className="text-muted-foreground mt-1">Add a player and assign them to the correct team.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
        {submissionError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{submissionError}</p>}
        <div className="space-y-2">
          <label className="text-sm font-medium">Player Photo (optional)</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-dashed border-input bg-muted flex items-center justify-center">
              {photoPreview ? <img src={photoPreview} alt="Player preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div>
              <input id="player-photo" type="file" className="hidden" accept="image/jpeg,image/png" onChange={handlePhotoChange} />
              <label htmlFor="player-photo" className="inline-flex items-center rounded-md border border-input h-9 px-3 text-sm font-medium cursor-pointer hover:bg-accent">
                <Upload className="w-4 h-4 mr-2" /> Upload JPG or PNG
              </label>
              <p className="text-xs text-muted-foreground mt-1">For bulk imports, add photos later from the player profile.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Player Name" error={errors.name?.message}>
            <input {...register("name")} placeholder="e.g. Kumar Sangakkara" className="w-full px-3 py-2 bg-transparent border border-input rounded-md" />
          </Field>
          <Field label="Phone Number" error={errors.phone_number?.message}>
            <input {...register("phone_number")} placeholder="e.g. +94771234567" className="w-full px-3 py-2 bg-transparent border border-input rounded-md" />
          </Field>
          <Field label="Playing Role" error={errors.playing_role?.message}>
            <select {...register("playing_role")} className="w-full px-3 py-2 bg-transparent border border-input rounded-md">
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-rounder">All-rounder</option>
              <option value="Wicket-keeper">Wicket-keeper</option>
            </select>
          </Field>
          <Field label="Team (optional)">
            <select {...register("team_id")} className="w-full px-3 py-2 bg-transparent border border-input rounded-md">
              <option value="">Unassigned</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </Field>
          <Field label="Batting Style">
            <select {...register("batting_style")} className="w-full px-3 py-2 bg-transparent border border-input rounded-md">
              <option value="">Not specified</option>
              <option value="Right-hand">Right-hand</option>
              <option value="Left-hand">Left-hand</option>
            </select>
          </Field>
          <Field label="Bowling Style">
            <select {...register("bowling_style")} className="w-full px-3 py-2 bg-transparent border border-input rounded-md">
              <option value="">Not specified</option>
              <option value="Right-arm fast">Right-arm fast</option>
              <option value="Right-arm medium">Right-arm medium</option>
              <option value="Right-arm off-spin">Right-arm off-spin</option>
              <option value="Right-arm leg-spin">Right-arm leg-spin</option>
              <option value="Left-arm fast">Left-arm fast</option>
              <option value="Left-arm medium">Left-arm medium</option>
              <option value="Left-arm orthodox">Left-arm orthodox</option>
              <option value="Left-arm wrist-spin">Left-arm wrist-spin</option>
            </select>
          </Field>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Link href={localePath(locale, returnPath)} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input h-10 px-4">Cancel</Link>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 disabled:opacity-50">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Player
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label className="text-sm font-medium">{label}</label>{children}{error && <p className="text-sm text-red-500">{error}</p>}</div>;
}
