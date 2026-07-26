export const BOWLER_CREDITED_DISMISSALS = new Set([
  "bowled",
  "caught",
  "caught_and_bowled",
  "lbw",
  "stumped",
  "hit_wicket",
]);

export function normalizeDismissalType(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replaceAll(" ", "_");
}

export function isBowlerCreditedDismissal(value: string | null | undefined) {
  return BOWLER_CREDITED_DISMISSALS.has(normalizeDismissalType(value));
}

export function isBowlerCreditedWicket(ball: {
  is_wicket: boolean;
  dismissal_type: string | null | undefined;
}) {
  return ball.is_wicket && isBowlerCreditedDismissal(ball.dismissal_type);
}

export function runsChargedToBowler(ball: {
  runs: number;
  extras: number;
  extras_type: string | null | undefined;
}) {
  const extrasType = normalizeDismissalType(ball.extras_type);
  return ball.runs + (extrasType === "bye" || extrasType === "leg_bye" ? 0 : ball.extras);
}

export function isHatTrick(
  previousBowlerDeliveries: Array<{ is_legal: boolean; is_wicket: boolean; dismissal_type: string | null | undefined }>,
  current: { is_legal: boolean; is_wicket: boolean; dismissal_type: string | null | undefined },
) {
  if (!current.is_legal || !isBowlerCreditedWicket(current)) return false;
  const previousLegal = previousBowlerDeliveries.filter((ball) => ball.is_legal).slice(-2);
  return previousLegal.length === 2 && previousLegal.every(isBowlerCreditedWicket);
}

export function getWicketLimit({
  squadSize,
  configuredWickets,
  lastManStands,
}: {
  squadSize: number;
  configuredWickets: number;
  lastManStands: boolean;
}) {
  const availableDismissals = squadSize - (lastManStands ? 0 : 1);
  return Math.max(1, Math.min(configuredWickets, availableDismissals));
}

export function shouldActivateLastMan({
  currentWickets,
  wicketLimit,
  lastManStands,
  availableReplacementBatters,
}: {
  currentWickets: number;
  wicketLimit: number;
  lastManStands: boolean;
  availableReplacementBatters: number;
}) {
  return lastManStands
    && currentWickets + 1 === wicketLimit - 1
    && availableReplacementBatters === 0;
}
