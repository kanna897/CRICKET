type BallEvent = {
  runs: number;
  isBoundary: boolean;
  isWicket: boolean;
  wicketType?: string;
  isExtra: boolean;
  extraType?: string;
  striker: string;
  bowler: string;
};

export function generateCommentary(event: BallEvent): string {
  if (event.isWicket) {
    return `WICKET! ${event.striker} dismissed by ${event.bowler}. (${event.wicketType || 'Out'})`;
  }
  
  if (event.isExtra) {
    if (event.extraType?.toLowerCase() === 'wide') return "Wide ball.";
    if (event.extraType?.toLowerCase() === 'no_ball') return "No ball.";
    return `Extra: ${event.extraType}.`;
  }
  
  if (event.runs === 6) {
    return "SIX! Maximum.";
  }
  
  if (event.runs === 4) {
    return "FOUR! Boundary scored.";
  }
  
  if (event.runs === 0) {
    return "Dot ball.";
  }
  
  if (event.runs === 1) {
    return "Single taken.";
  }

  return `${event.runs} runs scored.`;
}
