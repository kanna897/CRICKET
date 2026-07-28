import type { CommentaryInput } from "@/types/commentary";

const dismissalText: Record<NonNullable<CommentaryInput["wicketType"]>, string> = {
  bowled: "BOWLED! The stumps are disturbed",
  caught: "CAUGHT! The chance is taken",
  lbw: "LBW! Trapped in front",
  run_out: "RUN OUT! Brilliant work in the field",
  stumped: "STUMPED! Beaten in flight and out of the crease",
  hit_wicket: "HIT WICKET! An unfortunate way to go",
};

const zoneText: Record<NonNullable<CommentaryInput["shotZone"]>, string> = {
  straight: "straight down the ground",
  cover: "through the covers",
  point: "through point",
  square_leg: "behind square on the leg side",
  midwicket: "through midwicket",
  fine_leg: "over fine leg",
};

const runWords: Record<number, string> = {
  1: "a single",
  2: "two runs",
  3: "three runs",
  4: "four runs",
  5: "five runs",
  6: "six runs",
};

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function shotSuffix(input: CommentaryInput) {
  return input.shotZone ? ` ${zoneText[input.shotZone]}` : "";
}

function standardDelivery(input: CommentaryInput) {
  const shot = shotSuffix(input);
  if (input.runs === 0)
    return `Nothing on offer — ${input.bowlerName} keeps ${input.batterName} quiet.`;
  if (input.runs === 1)
    return `${input.batterName} works it${shot} and rotates the strike.`;
  if (input.runs === 2)
    return `${input.batterName} finds the gap${shot}; sharp running brings two.`;
  if (input.runs === 3)
    return `${input.batterName} places it beautifully${shot} and they come back for three.`;
  if (input.runs === 4)
    return `FOUR! Exquisite from ${input.batterName} — timed sweetly${shot} and away to the rope.`;
  if (input.runs === 6)
    return `SIX! Magnificent striking from ${input.batterName} — launched${shot} and comfortably over the boundary.`;
  return `${input.batterName} collects ${runWords[input.runs] || plural(input.runs, "run")}${shot}.`;
}

function extraDelivery(input: CommentaryInput) {
  const total = input.runs + input.extras;
  const shot = shotSuffix(input);
  if (input.extrasType === "wide")
    return total === 1
      ? `WIDE! ${input.bowlerName} strays beyond the batter's reach.`
      : `WIDE! It beats everyone and they collect ${plural(total, "run")} in all.`;
  if (input.extrasType === "no_ball") {
    if (!input.runs)
      return total === 1
        ? `NO BALL! ${input.bowlerName} oversteps — a free hit will follow.`
        : `NO BALL! ${input.bowlerName} oversteps and ${plural(total, "run")} are added in all.`;
    return `NO BALL! ${input.bowlerName} oversteps, and ${input.batterName} adds ${runWords[input.runs] || plural(input.runs, "run")}${shot} — ${plural(total, "run")} from the delivery.`;
  }
  if (input.extrasType === "bye")
    return `${input.extras === 1 ? "A bye" : `${input.extras} byes`} taken as the ball beats both batter and keeper.`;
  return `${input.extras === 1 ? "A leg bye" : `${input.extras} leg byes`} added off the pads.`;
}

function milestoneCommentary(input: CommentaryInput) {
  const milestones: string[] = [];
  if (input.batterScore === 50)
    milestones.push(`FIFTY for ${input.batterName} — a well-constructed innings.`);
  if (input.batterScore === 100)
    milestones.push(`A magnificent CENTURY for ${input.batterName}!`);
  if (input.teamScore === 50 || input.teamScore === 100)
    milestones.push(`The team total reaches ${input.teamScore}.`);
  if (input.partnership === 50)
    milestones.push("That also brings up a valuable fifty-run partnership.");
  if (input.bowlerWickets === 3)
    milestones.push(`${input.bowlerName} now has three wickets.`);
  if (input.bowlerWickets === 5)
    milestones.push(`FIVE wickets for ${input.bowlerName} — an outstanding spell.`);
  if (input.inningsComplete)
    milestones.push("That is the end of the innings.");
  if (input.matchResult)
    milestones.push(input.matchResult);
  return milestones;
}

function chaseSituation(input: CommentaryInput) {
  if (input.requiredRuns === undefined || input.ballsRemaining === undefined || input.requiredRuns <= 0)
    return "";
  return ` ${plural(input.requiredRuns, "run")} needed from ${plural(input.ballsRemaining, "ball")}.`;
}

export function generateCommentary(input: CommentaryInput): string {
  const prefix = `${input.over}.${input.ball}: ${input.bowlerName} to ${input.batterName} —`;
  let event: string;

  if (input.wicketType) {
    event = `${dismissalText[input.wicketType]}. ${input.batterName} has to go${input.wicketType === "run_out" ? "" : `, and ${input.bowlerName} has the breakthrough`}.`;
  } else if (input.extrasType) {
    event = extraDelivery(input);
  } else {
    event = standardDelivery(input);
  }

  const milestones = milestoneCommentary(input);
  const scoreline = ` Score: ${input.teamScore} after ${input.overs} overs.`;
  return `${prefix} ${event}${scoreline}${chaseSituation(input)}${milestones.length ? ` ${milestones.join(" ")}` : ""}`;
}
