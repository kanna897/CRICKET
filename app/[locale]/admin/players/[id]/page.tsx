"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Loader2, User } from "lucide-react";
import Link from "next/link";
import { Database } from "@/types/database.types";

type Player = Database['public']['Tables']['players']['Row'];

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function fetchPlayer() {
      const { data } = await supabase.from('players').select('*').eq('id', id).single();
      if (data) setPlayer(data);
      setLoading(false);
    }
    if (id) fetchPlayer();
  }, [id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${player.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('player_photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('player_photos')
        .getPublicUrl(filePath);

      const photo_url = publicUrlData.publicUrl;

      await supabase
        .from('players')
        // @ts-expect-error Supabase types infer never here incorrectly
        .update({ photo_url })
        .eq('id', player.id);

      setPlayer({ ...player, photo_url });
      alert("Photo uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  if (!player) return <div className="p-8 text-center text-red-500">Player not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/players" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Profile</h1>
          <p className="text-muted-foreground mt-1">ID: <span className="font-mono">{player.id}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar / Photo */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-muted bg-muted flex items-center justify-center relative">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
              
              <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white rounded-full">
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
              </label>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-muted-foreground text-sm font-mono mt-1">{player.phone_number}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {player.playing_role || "Unknown Role"}
            </span>
          </div>
        </div>

        {/* Details / Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Player Details</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-muted-foreground">Batting Style</p>
                <p className="font-medium">{player.batting_style || "Not Specified"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bowling Style</p>
                <p className="font-medium">{player.bowling_style || "Not Specified"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Team</p>
                <p className="font-medium text-primary cursor-pointer hover:underline">
                  {player.team_id ? "Assigned" : "Unassigned"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Career Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Matches</p>
                <p className="text-2xl font-bold mt-1">0</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Runs</p>
                <p className="text-2xl font-bold mt-1">0</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Wickets</p>
                <p className="text-2xl font-bold mt-1">0</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">High Score</p>
                <p className="text-2xl font-bold mt-1">0</p>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">Statistics will populate once the player participates in matches.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
