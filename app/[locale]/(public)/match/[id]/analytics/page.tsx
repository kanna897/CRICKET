"use client";

import { useParams } from "next/navigation";
import { MatchAnalyticsDashboard } from "@/components/match-analytics-dashboard";

export default function PublicMatchAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  return <main className="p-4 py-6 sm:p-7"><MatchAnalyticsDashboard matchId={id} /></main>;
}
