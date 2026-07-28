import type { CommentaryInput } from "@/types/commentary";

const zoneText: Record<NonNullable<CommentaryInput["shotZone"]>, string> = {
  straight: "straight",
  cover: "through cover",
  point: "through point",
  square_leg: "behind square",
  midwicket: "over midwicket",
  fine_leg: "over fine leg",
};

const dismissalText: Record<NonNullable<CommentaryInput["wicketType"]>, string> = {
  bowled: "bowled",
  caught: "caught",
  lbw: "lbw",
  run_out: "run out",
  stumped: "stumped",
  hit_wicket: "hit wicket",
};

function shot(input: CommentaryInput) {
  return input.shotZone ? ` ${zoneText[input.shotZone]}` : "";
}

function standardDelivery(input: CommentaryInput) {
  if (input.runs === 0)
    return `Dot. ${input.bowlerName} keeps ${input.batterName} quiet.`;
  if (input.runs === 1)
    return `${input.batterName} works it${shot(input)} for one.`;
  if (input.runs === 2)
    return `${input.batterName} finds the gap${shot(input)} for two.`;
  if (input.runs === 3)
    return `${input.batterName} places it${shot(input)}; three taken.`;
  if (input.runs === 4)
    return `FOUR! ${input.batterName} drives${shot(input)} to the rope.`;
  if (input.runs === 6)
    return `SIX! ${input.batterName} launches it${shot(input)}.`;
  return `${input.batterName} takes ${input.runs}.`;
}

function extraDelivery(input: CommentaryInput) {
  const total = input.runs + input.extras;
  if (input.extrasType === "wide")
    return total === 1 ? "Wide." : `Wide — ${total} added.`;
  if (input.extrasType === "no_ball") {
    if (!input.runs)
      return total === 1 ? "NO BALL! Free hit next." : `NO BALL! ${total} added.`;
    return `NO BALL! ${input.batterName} adds ${input.runs}${shot(input)}; ${total} total.`;
  }
  if (input.extrasType === "bye")
    return input.extras === 1 ? "One bye." : `${input.extras} byes.`;
  return input.extras === 1 ? "One leg bye." : `${input.extras} leg byes.`;
}

function milestones(input: CommentaryInput) {
  const calls: string[] = [];
  if (input.batterScore === 50)
    calls.push(`FIFTY for ${input.batterName}!`);
  if (input.batterScore === 100)
    calls.push(`CENTURY for ${input.batterName}!`);
  if (input.partnership === 50)
    calls.push("Fifty partnership.");
  if (input.bowlerWickets === 3)
    calls.push(`Three wickets for ${input.bowlerName}.`);
  if (input.bowlerWickets === 5)
    calls.push(`FIVE wickets for ${input.bowlerName}!`);
  if (input.inningsComplete)
    calls.push("Innings complete.");
  if (input.matchResult)
    calls.push(input.matchResult);
  return calls;
}

function chase(input: CommentaryInput) {
  if (input.requiredRuns === undefined || input.ballsRemaining === undefined || input.requiredRuns <= 0)
    return "";
  return ` • Need ${input.requiredRuns} off ${input.ballsRemaining}.`;
}

export function generateCommentary(input: CommentaryInput): string {
  let event: string;
  if (input.wicketType) {
    event = `WICKET! ${input.batterName} ${dismissalText[input.wicketType]}${input.wicketType === "run_out" ? "" : ` by ${input.bowlerName}`}.`;
  } else if (input.extrasType) {
    event = extraDelivery(input);
  } else {
    event = standardDelivery(input);
  }

  const specialCalls = milestones(input);
  return `${input.over}.${input.ball}: ${event} ${input.teamScore} (${input.overs})${chase(input)}${specialCalls.length ? ` ${specialCalls.join(" ")}` : ""}`;
}
