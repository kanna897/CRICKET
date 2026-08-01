import "server-only";

import { cache } from "react";
import { isActivePublicMatch, type PublicMatchVisibilityRow } from "@/lib/public-match-visibility";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const getActivePublicMatchById = cache(async (matchId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,tournament_id,tournaments(deleted_at)")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !isActivePublicMatch(data as PublicMatchVisibilityRow | null)) return null;
  const row = data as PublicMatchVisibilityRow;
  return { id: row.id, tournamentId: row.tournament_id };
});
