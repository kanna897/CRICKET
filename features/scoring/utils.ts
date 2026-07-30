import type { Ball } from "./types";

export function deliveryBadgeLabel(ball: Ball) {
  if (ball.is_wicket) return "W";
  const total = ball.runs + ball.extras;
  if (ball.extras_type === "wide") return total > 1 ? `Wd+${total - 1}` : "Wd";
  if (ball.extras_type === "no_ball") return total > 1 ? `NB+${total - 1}` : "NB";
  if (ball.extras_type === "bye") return `B${ball.extras}`;
  if (ball.extras_type === "leg_bye") return `LB${ball.extras}`;
  return String(total);
}
