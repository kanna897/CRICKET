import type { CommentaryInput } from "@/types/commentary";

const dismissalText: Record<NonNullable<CommentaryInput["wicketType"]>, string> = {
  bowled: "is bowled",
  caught: "is caught",
  lbw: "is LBW",
  run_out: "is run out",
  stumped: "is stumped",
  hit_wicket: "hits the wicket",
};

export function generateCommentary(input: CommentaryInput): string {
  const prefix = `${input.over}.${input.ball}:`;
  const zoneText: Record<NonNullable<CommentaryInput["shotZone"]>, string> = {
    straight: "straight down the ground",
    cover: "through cover",
    point: "through point",
    square_leg: "towards square leg",
    midwicket: "through midwicket",
    fine_leg: "towards fine leg",
  };
  let event: string;
  if (input.wicketType) {
    const dismissal = dismissalText[input.wicketType];
    event = input.wicketType === "run_out"
      ? `WICKET! ${input.batterName} ${dismissal}.`
      : `WICKET! ${input.batterName} ${dismissal}. Wicket for ${input.bowlerName}.`;
  } else if (input.extrasType === "wide") event = `Wide by ${input.bowlerName}. ${input.extras} extra run${input.extras === 1 ? "" : "s"} awarded.`;
  else if (input.extrasType === "no_ball") event = `No ball by ${input.bowlerName}. ${input.extras} extra run${input.extras === 1 ? "" : "s"} awarded.`;
  else if (input.extrasType === "bye") event = `Bye taken. ${input.extras} extra run${input.extras === 1 ? "" : "s"}.`;
  else if (input.extrasType === "leg_bye") event = `Leg bye taken. ${input.extras} extra run${input.extras === 1 ? "" : "s"}.`;
  else if (input.runs === 0) event = `Dot ball to ${input.batterName} by ${input.bowlerName}.`;
  else if (input.runs === 1) event = `${input.batterName} takes a single.`;
  else if (input.runs === 2) event = `${input.batterName} picks up two runs.`;
  else if (input.runs === 3) event = `${input.batterName} runs three.`;
  else if (input.runs === 4) event = `FOUR! ${input.batterName} scores a boundary.`;
  else if (input.runs === 6) event = `SIX! ${input.batterName} adds six runs.`;
  else event = `${input.batterName} scores ${input.runs} runs.`;
  if (!input.extrasType && !input.wicketType && input.shotZone) {
    event += ` Shot played ${zoneText[input.shotZone]}.`;
  }

  const milestones: string[] = [];
  if (input.batterScore === 50 || input.batterScore === 100) milestones.push(`${input.batterName} reaches ${input.batterScore}.`);
  if (input.teamScore === 50 || input.teamScore === 100) milestones.push(`Team reaches ${input.teamScore}.`);
  if (input.partnership === 50) milestones.push("Fifty partnership.");
  if (input.bowlerWickets === 3 || input.bowlerWickets === 5) milestones.push(`${input.bowlerName} has ${input.bowlerWickets} wickets.`);
  if (input.inningsComplete) milestones.push("Innings complete.");
  if (input.matchResult) milestones.push(input.matchResult);
  return `${prefix} ${event} Score: ${input.teamScore} (${input.overs}).${milestones.length ? ` ${milestones.join(" ")}` : ""}`;
}
