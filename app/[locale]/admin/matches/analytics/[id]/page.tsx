"use client";

import { useParams } from "next/navigation";
import { MatchAnalyticsDashboard } from "@/components/match-analytics-dashboard";

export default function AdminMatchAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  return <MatchAnalyticsDashboard matchId={id} admin />;
}
