export type RoundRobinPairing = { teamAId: string; teamBId: string };
export type RoundRobinRound = { round: number; matches: RoundRobinPairing[]; byeTeamId: string | null };
export type ScheduledRoundRobinMatch = RoundRobinPairing & { round: number; dayIndex: number; slotIndex: number };

export function generateSingleRoundRobin(teamIds: string[]): RoundRobinRound[] {
  const uniqueIds = [...new Set(teamIds)];
  if (uniqueIds.length < 2) throw new Error("At least two unique teams are required.");

  const bye = "__BYE__";
  const rotation = uniqueIds.length % 2 === 0 ? [...uniqueIds] : [...uniqueIds, bye];
  const roundCount = rotation.length - 1;
  const rounds: RoundRobinRound[] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const matches: RoundRobinPairing[] = [];
    let byeTeamId: string | null = null;

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (left === bye || right === bye) {
        byeTeamId = left === bye ? right : left;
        continue;
      }
      const reverse = roundIndex % 2 === 1;
      matches.push(reverse ? { teamAId: right, teamBId: left } : { teamAId: left, teamBId: right });
    }

    rounds.push({ round: roundIndex + 1, matches, byeTeamId });
    rotation.splice(1, 0, rotation.pop()!);
  }

  return rounds;
}

export function validateSingleRoundRobin(teamIds: string[], rounds: RoundRobinRound[]) {
  const expectedTeams = new Set(teamIds);
  const pairings = new Set<string>();
  const byes = new Map(teamIds.map((id) => [id, 0]));

  for (const round of rounds) {
    const roundTeams = new Set<string>();
    for (const match of round.matches) {
      if (!expectedTeams.has(match.teamAId) || !expectedTeams.has(match.teamBId)) throw new Error("Fixture contains an unknown team.");
      if (match.teamAId === match.teamBId) throw new Error("A team cannot play itself.");
      if (roundTeams.has(match.teamAId) || roundTeams.has(match.teamBId)) throw new Error(`A team appears more than once in Round ${round.round}.`);
      roundTeams.add(match.teamAId);
      roundTeams.add(match.teamBId);
      const key = [match.teamAId, match.teamBId].sort().join(":");
      if (pairings.has(key)) throw new Error("Duplicate team pairing generated.");
      pairings.add(key);
    }
    if (round.byeTeamId) byes.set(round.byeTeamId, (byes.get(round.byeTeamId) || 0) + 1);
  }

  const expectedMatches = teamIds.length * (teamIds.length - 1) / 2;
  if (pairings.size !== expectedMatches) throw new Error(`Expected ${expectedMatches} matches but generated ${pairings.size}.`);
  if (teamIds.length % 2 === 1 && [...byes.values()].some((count) => count !== 1)) throw new Error("Each team must receive exactly one BYE.");
  return true;
}

export function scheduleRoundRobinMatches(rounds: RoundRobinRound[], matchesPerDay: number): ScheduledRoundRobinMatch[] {
  const dailyLimit = Math.max(1, Math.floor(matchesPerDay));
  const pending = rounds.flatMap((round) => round.matches.map((match) => ({ ...match, round: round.round })));
  const scheduled: ScheduledRoundRobinMatch[] = [];
  let dayIndex = 0;

  while (pending.length) {
    let previousTeams = new Set<string>();
    for (let slotIndex = 0; slotIndex < dailyLimit && pending.length; slotIndex += 1) {
      const eligibleIndex = pending.findIndex((match) => !previousTeams.has(match.teamAId) && !previousTeams.has(match.teamBId));
      if (eligibleIndex < 0) break;
      const [match] = pending.splice(eligibleIndex, 1);
      scheduled.push({ ...match, dayIndex, slotIndex });
      previousTeams = new Set([match.teamAId, match.teamBId]);
    }
    dayIndex += 1;
  }

  return scheduled;
}
