import { notFound } from "next/navigation";
import { getActivePublicMatchById } from "@/lib/public-match";
import { PublicLiveMatchClient } from "./match-client";

export default async function PublicLiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!await getActivePublicMatchById(id)) notFound();
  return <PublicLiveMatchClient />;
}
