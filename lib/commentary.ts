import type { CommentaryInput } from "@/types/commentary";

const zoneText: Record<NonNullable<CommentaryInput["shotZone"]>, string> = {
  straight: "straight",
  cover: "through cover",
  point: "through point",
  square_leg: "behind square",
  midwicket: "over midwicket",
  fine_leg: "over fine leg",
};

const dismissalText: Record<string, string> = {
  bowled: "bowled",
  caught: "caught",
  lbw: "lbw",
  run_out: "run out",
  stumped: "stumped",
  hit_wicket: "hit wicket",
  retired_hurt: "retired hurt",
  retired_out: "retired out",
  obstructing_field: "obstructing field",
  timed_out: "timed out",
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
    return total === 1 ? "Bye." : `Byes — ${total} added.`;
  if (input.extrasType === "leg_bye")
    return total === 1 ? "Leg bye." : `Leg byes — ${total} added.`;
  return `${total} extra${total === 1 ? "" : "s"}.`;
}

function milestones(input: CommentaryInput) {
  const calls: string[] = [];
  if (input.batterScore >= 50 && input.batterScore - input.runs < 50)
    calls.push(`FIFTY FOR ${input.batterName.toUpperCase()}!`);
  if (input.batterScore >= 100 && input.batterScore - input.runs < 100)
    calls.push(`CENTURY FOR ${input.batterName.toUpperCase()}!`);
  if (input.partnership && input.partnership >= 50 && input.partnership - input.runs - input.extras < 50)
    calls.push("50-run partnership up.");
  if (input.partnership && input.partnership >= 100 && input.partnership - input.runs - input.extras < 100)
    calls.push("Century partnership up.");
  if (input.bowlerWickets === 3 && input.wicketType)
    calls.push(`Three wickets in the bag for ${input.bowlerName}.`);
  if (input.bowlerWickets >= 5 && input.wicketType)
    calls.push(`FIVE-WICKET HAUL for ${input.bowlerName}!`);
  return calls;
}

function chase(input: CommentaryInput) {
  if (input.inningsComplete && input.matchResult)
    return ` ${input.matchResult}`;
  if (input.requiredRuns === undefined || input.ballsRemaining === undefined)
    return "";
  if (input.requiredRuns === 0)
    return " Target reached!";
  return ` Need ${input.requiredRuns} from ${input.ballsRemaining} balls.`;
}

export function generateCommentary(input: CommentaryInput): string {
  let event: string;
  if (input.wicketType) {
    if (input.wicketType === "retired_hurt") {
      event = `${input.batterName} retired hurt.`;
    } else if (input.wicketType === "run_out" && input.runs && input.runs > 0) {
      event = `WICKET! ${input.batterName} completed ${input.runs} run${input.runs === 1 ? "" : "s"} and was run out!`;
    } else {
      event = `WICKET! ${input.batterName} ${dismissalText[input.wicketType] || input.wicketType}${input.wicketType === "run_out" ? "" : ` by ${input.bowlerName}`}.`;
    }
  } else if (input.extrasType) {
    event = extraDelivery(input);
  } else {
    event = standardDelivery(input);
  }

  const specialCalls = milestones(input);
  return `${input.over}.${input.ball}: ${event} ${input.teamScore} (${input.overs})${chase(input)}${specialCalls.length ? ` ${specialCalls.join(" ")}` : ""}`;
}
