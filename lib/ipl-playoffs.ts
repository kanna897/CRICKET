export type IplPlayoffMatch = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  winner_id: string | null;
  status: string;
  bracket_round: number;
  bracket_slot: number;
  match_date: string | null;
};

export const playoffKey = (match: Pick<IplPlayoffMatch, "bracket_round" | "bracket_slot">) => `${match.bracket_round}-${match.bracket_slot}`;
export const playoffTitle = (match: Pick<IplPlayoffMatch, "bracket_round" | "bracket_slot">) =>
  match.bracket_round === 10 ? `Semi Final ${match.bracket_slot}` :
  match.bracket_round === 11 ? "Final" :
  match.bracket_round === 1 && match.bracket_slot === 1 ? "Qualifier 1" :
  match.bracket_round === 1 && match.bracket_slot === 2 ? "Eliminator" :
  match.bracket_round === 2 ? "Qualifier 2" : "Final";

export function loserOf(match?: IplPlayoffMatch) {
  if (!match?.winner_id) return null;
  return match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
}

export function shortTeamName(name: string) {
  const clean = name.trim();
  const words = clean.split(/\s+/);
  return words.length > 2 ? words.map((word) => word[0]).join("").slice(0, 5).toUpperCase() : clean.slice(0, 16);
}

export function playoffFormat(matches: IplPlayoffMatch[]) {
  return matches.some((match) => match.bracket_round >= 10) ? "knockout" as const : "league" as const;
}
