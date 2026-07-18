"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import Link from "next/link";

export default function TeamSheetPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  // In a real app we'd fetch the actual match and team players
  const [matchData] = useState({
    team1: "Chennai Super Kings",
    team2: "Mumbai Indians",
    date: new Date().toLocaleDateString(),
    venue: "Wankhede Stadium"
  });

  const dummyPlayers = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}`, role: i === 0 ? "Captain" : i === 1 ? "Wicket Keeper" : "Batsman" }));

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, [id]);

  if (loading) return <div className="p-12 text-center text-primary">Loading Team Sheet...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-12 print:max-w-full print:p-0">
      {/* Non-Printable Header */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/admin/matches" className="p-2 bg-muted hover:bg-muted/80 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary"/> Playing XI Team Sheet</h1>
            <p className="text-muted-foreground text-sm">Review and print the official team declarations before the toss.</p>
          </div>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md shadow-sm hover:bg-primary/90"
        >
          <Printer className="w-5 h-5" /> Print Sheets
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white text-black p-8 rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-none print:m-0 print:p-0">
        
        {/* Header Section */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-black uppercase tracking-widest">OFFICIAL TEAM SHEET</h1>
          <div className="mt-2 text-lg font-medium">
            <span>{matchData.team1}</span> <span className="text-gray-500 mx-2">vs</span> <span>{matchData.team2}</span>
          </div>
          <div className="mt-1 text-sm text-gray-600 font-mono">
            Date: {matchData.date} | Venue: {matchData.venue} | Match ID: {id}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 print:gap-4">
          
          {/* Team 1 Sheet */}
          <div>
            <div className="bg-gray-100 p-3 text-center font-bold text-xl uppercase border border-gray-300 mb-4">
              {matchData.team1}
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 w-12 text-center">No.</th>
                  <th className="py-2">Player Name</th>
                  <th className="py-2 w-32">Role</th>
                </tr>
              </thead>
              <tbody>
                {dummyPlayers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-300">
                    <td className="py-2 text-center font-bold text-gray-500">{p.id}</td>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-sm text-gray-600">{p.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-8 pt-4 border-t border-dashed border-gray-400">
              <p className="text-sm text-gray-500 mb-6">Captain&apos;s Signature:</p>
              <div className="border-b border-black w-64"></div>
            </div>
          </div>

          {/* Team 2 Sheet */}
          <div>
            <div className="bg-gray-100 p-3 text-center font-bold text-xl uppercase border border-gray-300 mb-4">
              {matchData.team2}
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 w-12 text-center">No.</th>
                  <th className="py-2">Player Name</th>
                  <th className="py-2 w-32">Role</th>
                </tr>
              </thead>
              <tbody>
                {dummyPlayers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-300">
                    <td className="py-2 text-center font-bold text-gray-500">{p.id}</td>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-sm text-gray-600">{p.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-8 pt-4 border-t border-dashed border-gray-400">
              <p className="text-sm text-gray-500 mb-6">Captain&apos;s Signature:</p>
              <div className="border-b border-black w-64"></div>
            </div>
          </div>

        </div>

        <div className="mt-12 text-center text-xs text-gray-400 print:mt-8">
          CRICKPULSE Official Export • Generated {new Date().toLocaleString()}
        </div>

      </div>
    </div>
  );
}
