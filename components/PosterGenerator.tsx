"use client";

import React, { useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Download, Loader2, Upload } from "lucide-react";
import { uploadImage } from "@/lib/media";
import { downloadPosterDataUrl, posterPixelRatio, posterQualityLabel, type PosterQuality } from "@/lib/poster-export";

interface PosterProps {
  matchData: {
    tournamentName: string;
    tournamentLogo?: string;
    matchNumber: string;
    team1: { name: string; logo?: string; score: string; overs: string };
    team2: { name: string; logo?: string; score: string; overs: string };
    result: string;
    playerOfMatch: { name: string; photo?: string; team: string; performance: string };
    topBatters: { name: string; stats: string }[];
    topBowlers: { name: string; stats: string }[];
  }
}

export function PosterGenerator({ matchData }: PosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloading, setDownloading] = useState<PosterQuality | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  const createPosterFile = async (quality: PosterQuality = "4k") => {
    if (!posterRef.current) throw new Error("Poster is not ready.");
    const dataUrl = await htmlToImage.toJpeg(posterRef.current, {
      cacheBust: true,
      quality: 0.99,
      pixelRatio: posterPixelRatio(posterRef.current, quality),
      width: 1080,
      height: 1080,
      backgroundColor: "#0f172a",
      style: { transform: "none", transformOrigin: "center", margin: "0" },
    });
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], `match-${matchData.matchNumber}-${quality}-summary.jpg`, { type: "image/jpeg" });
  };

  const downloadPoster = async (quality: PosterQuality) => {
    setDownloading(quality);
    try {
      const file = await createPosterFile(quality);
      const objectUrl = URL.createObjectURL(file);
      await downloadPosterDataUrl(objectUrl, file.name);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Error generating poster", err);
      alert("Failed to generate poster.");
    } finally {
      setDownloading(null);
    }
  };

  const uploadPoster = async () => {
    setIsUploading(true);
    try {
      const file = await createPosterFile();
      const { url } = await uploadImage(file, "posters");
      setPosterUrl(url);
    } catch (err) {
      console.error("Error uploading poster", err);
      alert("Failed to upload poster.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <button onClick={uploadPoster} disabled={isUploading} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-60">
          {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {isUploading ? "Uploading…" : "Upload JPG Poster"}
        </button>
        {(["4k"] as PosterQuality[]).map((quality) => (
          <button key={quality} onClick={() => void downloadPoster(quality)} disabled={!!downloading} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-60">
            <Download className="w-4 h-4 mr-2" />
            {downloading === quality ? `Creating ${posterQualityLabel(quality)}…` : `Download ${posterQualityLabel(quality)} JPG`}
          </button>
        ))}
      </div>
      {posterUrl && <a href={posterUrl} target="_blank" rel="noreferrer" className="block text-right text-sm text-primary hover:underline">View uploaded poster</a>}

      {/* The Actual Poster DOM Element */}
      <div className="overflow-x-auto bg-muted p-4 rounded-xl flex justify-center">
        <div 
          ref={posterRef} 
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex flex-col p-12 text-white font-sans shadow-2xl"
          style={{ transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: '-540px' }}
        >
          {/* Background overlay patterns could go here */}
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/20 pb-8">
            <div className="flex items-center gap-6">
              {matchData.tournamentLogo ? (
                <img src={matchData.tournamentLogo} alt={`${matchData.tournamentName} logo`} className="w-24 h-24 rounded-full bg-white object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center font-bold text-3xl">SPL</div>
              )}
              <div>
                <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                  {matchData.tournamentName}
                </h1>
                <p className="text-2xl text-white/70 tracking-widest uppercase mt-2">Match {matchData.matchNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold bg-white/10 px-6 py-2 rounded-full border border-white/20">
                SUMMARY
              </p>
            </div>
          </div>

          {/* Scores */}
          <div className="flex-1 flex flex-col justify-center gap-12 my-8">
            {/* Team 1 */}
            <div className="flex items-center justify-between bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-white/20 p-2">
                  <div className="w-full h-full bg-primary rounded-xl"></div>
                </div>
                <h2 className="text-5xl font-bold uppercase">{matchData.team1.name}</h2>
              </div>
              <div className="text-right">
                <h3 className="text-7xl font-black tracking-tighter text-yellow-400">{matchData.team1.score}</h3>
                <p className="text-2xl text-white/60">({matchData.team1.overs} Overs)</p>
              </div>
            </div>

            {/* Team 2 */}
            <div className="flex items-center justify-between bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-white/20 p-2">
                  <div className="w-full h-full bg-blue-500 rounded-xl"></div>
                </div>
                <h2 className="text-5xl font-bold uppercase">{matchData.team2.name}</h2>
              </div>
              <div className="text-right">
                <h3 className="text-7xl font-black tracking-tighter text-yellow-400">{matchData.team2.score}</h3>
                <p className="text-2xl text-white/60">({matchData.team2.overs} Overs)</p>
              </div>
            </div>
            
            {/* Result */}
            <div className="text-center">
              <p className="text-4xl font-bold text-white bg-green-500/20 inline-block px-12 py-4 rounded-full border border-green-500/50 uppercase tracking-wide">
                {matchData.result}
              </p>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-3 gap-8 h-[300px]">
            {/* Top Performers */}
            <div className="col-span-2 grid grid-cols-2 gap-8">
              <div className="bg-black/40 rounded-2xl p-6 border border-white/10">
                <h4 className="text-2xl font-bold text-yellow-400 mb-6 uppercase tracking-wider">Top Batters</h4>
                <div className="space-y-4">
                  {matchData.topBatters.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xl">
                      <span className="font-semibold">{b.name}</span>
                      <span className="font-mono text-white/80">{b.stats}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-black/40 rounded-2xl p-6 border border-white/10">
                <h4 className="text-2xl font-bold text-yellow-400 mb-6 uppercase tracking-wider">Top Bowlers</h4>
                <div className="space-y-4">
                  {matchData.topBowlers.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xl">
                      <span className="font-semibold">{b.name}</span>
                      <span className="font-mono text-white/80">{b.stats}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* POTM */}
            <div className="bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-2xl p-1 relative overflow-hidden flex flex-col">
              <div className="absolute top-4 left-0 w-full text-center z-10">
                <span className="bg-black text-yellow-400 text-lg font-black uppercase tracking-widest px-6 py-2 rounded-full">
                  Player of the Match
                </span>
              </div>
              <div className="bg-black flex-1 rounded-xl mt-6 p-6 flex flex-col items-center justify-end text-center relative overflow-hidden">
                {matchData.playerOfMatch.photo ? (
                  <img src={matchData.playerOfMatch.photo} alt={matchData.playerOfMatch.name} className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-luminosity" />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-white/5"></div>
                )}
                <div className="relative z-10 w-full pt-24 bg-gradient-to-t from-black via-black/80 to-transparent">
                  <h3 className="text-3xl font-black text-white">{matchData.playerOfMatch.name}</h3>
                  <p className="text-yellow-400 font-bold text-xl mt-1">{matchData.playerOfMatch.performance}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
