/**
 * Cricket Calculations Engine
 */

export function calculateStrikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0.0;
  return Number(((runs / balls) * 100).toFixed(2));
}

export function calculateEconomyRate(runsConceded: number, overs: number): number {
  if (overs === 0) return 0.0;
  // Convert overs (e.g. 4.3) to total balls, then calculate economy
  const totalBalls = convertOversToBalls(overs);
  return Number(((runsConceded / totalBalls) * 6).toFixed(2));
}

export function calculateBattingAverage(runs: number, dismissals: number): number {
  if (dismissals === 0) return runs; // Technically undefined/infinity, but conventionally shown as runs or N/A
  return Number((runs / dismissals).toFixed(2));
}

export function calculateBowlingAverage(runsConceded: number, wickets: number): number {
  if (wickets === 0) return 0.0; // Conventionally infinite or zero
  return Number((runsConceded / wickets).toFixed(2));
}

export function calculateRunRate(runs: number, overs: number): number {
  if (overs === 0) return 0.0;
  const totalBalls = convertOversToBalls(overs);
  return Number(((runs / totalBalls) * 6).toFixed(2));
}

export function calculateRequiredRunRate(target: number, currentRuns: number, oversLeft: number): number {
  if (oversLeft <= 0) return 0.0;
  const runsNeeded = target - currentRuns;
  if (runsNeeded <= 0) return 0.0;
  const ballsLeft = convertOversToBalls(oversLeft);
  return Number(((runsNeeded / ballsLeft) * 6).toFixed(2));
}

export function calculateNetRunRate(
  teamRunsScored: number, teamOversFaced: number,
  opponentRunsScored: number, opponentOversFaced: number
): number {
  const teamRR = calculateRunRate(teamRunsScored, teamOversFaced);
  const opponentRR = calculateRunRate(opponentRunsScored, opponentOversFaced);
  return Number((teamRR - opponentRR).toFixed(3));
}

/**
 * Utility to convert overs format (e.g., 4.3 overs) to total valid balls (4 * 6 + 3 = 27 balls)
 */
export function convertOversToBalls(overs: number): number {
  const integerPart = Math.floor(overs);
  const fractionalPart = Math.round((overs - integerPart) * 10);
  return (integerPart * 6) + fractionalPart;
}

/**
 * Utility to convert total balls to overs format (e.g., 27 balls -> 4.3 overs)
 */
export function convertBallsToOvers(balls: number): number {
  const completeOvers = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return completeOvers + (remainingBalls / 10);
}

export function calculatePoints(winnerId: string, team1Id: string, team2Id: string) {
  if (winnerId === 'TIE') {
    return { team1Points: 1, team2Points: 1 };
  } else if (winnerId === 'NO_RESULT') {
    return { team1Points: 1, team2Points: 1 };
  } else if (winnerId === team1Id) {
    return { team1Points: 2, team2Points: 0 };
  } else if (winnerId === team2Id) {
    return { team1Points: 0, team2Points: 2 };
  }
  return { team1Points: 0, team2Points: 0 };
}
