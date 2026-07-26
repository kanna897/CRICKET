import { getWicketLimit } from "../../lib/cricket-rules.ts";

export function initialSimulatedInnings() {
  return { runs: 0, wickets: 0, legalBalls: 0, extras: 0, completed: false, completionReason: null };
}

export function simulateDelivery(state, rules, delivery) {
  if (state.completed) return state;
  if (!Number.isInteger(rules.overs) || rules.overs < 1) throw new Error("Overs must be a positive integer.");
  if (!Number.isInteger(rules.ballsPerOver) || rules.ballsPerOver < 4 || rules.ballsPerOver > 10) throw new Error("Balls per over must be between 4 and 10.");
  if (delivery.batterRuns < 0 || delivery.extras < 0) throw new Error("Runs cannot be negative.");

  const runs = state.runs + delivery.batterRuns + delivery.extras;
  const legalBalls = state.legalBalls + (delivery.legal ? 1 : 0);
  const wicketLimit = getWicketLimit({
    squadSize: rules.squadSize,
    configuredWickets: rules.wicketsPerInnings,
    lastManStands: rules.lastManStands,
  });
  const wickets = Math.min(wicketLimit, state.wickets + (delivery.wicket ? 1 : 0));
  const allOut = wickets >= wicketLimit;
  const oversComplete = legalBalls >= rules.overs * rules.ballsPerOver;
  const targetReached = Boolean(rules.target && runs >= rules.target);
  const completionReason = targetReached ? "target" : allOut ? "all_out" : oversComplete ? "overs" : null;

  return {
    runs,
    wickets,
    legalBalls,
    extras: state.extras + delivery.extras,
    completed: completionReason !== null,
    completionReason,
  };
}

export function formatSimulatedOvers(legalBalls, ballsPerOver) {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

export function simulateInnings(rules, deliveries) {
  return deliveries.reduce(
    (state, delivery) => simulateDelivery(state, rules, delivery),
    initialSimulatedInnings(),
  );
}

export function simulatedMatchResult({
  firstInningsRuns,
  chase,
  chasingTeam,
  defendingTeam,
  chasingWicketLimit,
}) {
  const target = firstInningsRuns + 1;
  if (chase.runs >= target) {
    const wicketsRemaining = Math.max(chasingWicketLimit - chase.wickets, 0);
    return {
      winner: chasingTeam,
      result: `${chasingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`,
    };
  }
  if (chase.runs === firstInningsRuns) return { winner: null, result: "Match tied" };
  const margin = firstInningsRuns - chase.runs;
  return {
    winner: defendingTeam,
    result: `${defendingTeam} won by ${margin} run${margin === 1 ? "" : "s"}`,
  };
}
