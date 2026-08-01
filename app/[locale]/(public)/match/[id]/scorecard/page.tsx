import { notFound } from "next/navigation";
import { MatchScorecardPage } from "@/app/[locale]/admin/matches/scorecard/[id]/page";
import { getActivePublicMatchById } from "@/lib/public-match";

export default async function PublicMatchScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!await getActivePublicMatchById(id)) notFound();
  return <main className="mx-auto max-w-5xl p-4 sm:p-6"><MatchScorecardPage publicMode /></main>;
}
