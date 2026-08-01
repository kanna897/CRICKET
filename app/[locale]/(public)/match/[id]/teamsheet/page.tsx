import { notFound } from "next/navigation";
import { getActivePublicMatchById } from "@/lib/public-match";
import PublicTeamSheetClient from "./teamsheet-client";

export default async function PublicTeamSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!await getActivePublicMatchById(id)) notFound();
  return <PublicTeamSheetClient />;
}
