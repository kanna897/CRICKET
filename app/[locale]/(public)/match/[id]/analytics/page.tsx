import { notFound } from "next/navigation";
import { MatchAnalyticsDashboard } from "@/components/match-analytics-dashboard";
import { getActivePublicMatchById } from "@/lib/public-match";

export default async function PublicMatchAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  if (!await getActivePublicMatchById(id)) notFound();
  return <main className="p-4 py-6 sm:p-7"><MatchAnalyticsDashboard matchId={id} locale={locale} /></main>;
}
