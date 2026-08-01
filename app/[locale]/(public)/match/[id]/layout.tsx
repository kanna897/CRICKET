import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLocale, entityMetadata, publicSupabase, seoCopy } from "@/lib/seo";
import { getActivePublicMatchById } from "@/lib/public-match";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = asLocale(rawLocale);
  if (!await getActivePublicMatchById(id)) {
    return { title: "Cricket Match", robots: { index: false, follow: false } };
  }
  const db = publicSupabase();
  if (!db) return { title: "Cricket Match", robots: { index: false, follow: false } };
  const { data: match } = await db.from("matches")
    .select("team_a_id,team_b_id,status,match_date,ground").eq("id", id).maybeSingle();
  if (!match) return { title: "Cricket Match", robots: { index: false, follow: false } };
  const { data: teams } = await db.from("teams").select("id,name,logo_url")
    .in("id", [match.team_a_id, match.team_b_id]);
  const teamA = teams?.find((team) => team.id === match.team_a_id);
  const teamB = teams?.find((team) => team.id === match.team_b_id);
  const title = `${teamA?.name ?? "Team A"} vs ${teamB?.name ?? "Team B"}`;
  const details = [match.status === "live" ? "LIVE" : match.status, match.match_date, match.ground]
    .filter(Boolean).join(" · ");
  return entityMetadata({
    locale,
    path: `/match/${id}`,
    title,
    description: `${title}. ${details}. ${seoCopy(locale).match}`,
    image: teamA?.logo_url ?? teamB?.logo_url,
  });
}

export default async function MatchMetadataLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  if (!await getActivePublicMatchById(id)) notFound();
  return children;
}
