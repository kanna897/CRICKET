"use client";

import { useParams } from "next/navigation";
import { MatchAnalyticsDashboard } from "@/components/match-analytics-dashboard";

export default function AdminMatchAnalyticsPage() {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  return <main className="admin-themed-page"><MatchAnalyticsDashboard matchId={id} locale={locale} admin /></main>;
}
