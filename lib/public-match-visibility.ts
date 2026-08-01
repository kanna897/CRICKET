export type TournamentVisibility = { deleted_at: string | null };
export type PublicMatchVisibilityRow = {
  id: string;
  tournament_id: string | null;
  tournaments: TournamentVisibility | TournamentVisibility[] | null;
};

function parentTournament(row: PublicMatchVisibilityRow) {
  return Array.isArray(row.tournaments) ? row.tournaments[0] ?? null : row.tournaments;
}

export function isActivePublicMatch(row: PublicMatchVisibilityRow | null) {
  if (!row) return false;
  if (row.tournament_id === null) return true;
  const tournament = parentTournament(row);
  return tournament !== null && tournament.deleted_at === null;
}
