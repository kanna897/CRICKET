import type { Ball } from "./types";

export function deliveryBadgeLabel(ball: Ball) {
  if (ball.is_wicket) return "W";
  const total = ball.runs + ball.extras;
  if (ball.extras_type === "wide") return total > 1 ? `Wd+${total - 1}` : "Wd";
  if (ball.extras_type === "no_ball") return total > 1 ? `NB+${total - 1}` : "NB";
  if (ball.extras_type === "bye") return ball.extras > 1 ? `B${ball.extras}` : "B";
  if (ball.extras_type === "leg_bye") return ball.extras > 1 ? `LB${ball.extras}` : "LB";
  return String(total);
}

export function deliveryBadgeClass(ball: Ball) {
  if (ball.is_wicket) {
    return "bg-red-600 text-white border border-red-400";
  }
  if (ball.extras_type) {
    return "bg-amber-400 text-slate-950 border border-amber-300";
  }
  if (ball.runs === 6) {
    return "bg-purple-600 text-white border border-purple-400";
  }
  if (ball.runs === 4) {
    return "bg-emerald-500 text-white border border-emerald-400";
  }
  if (ball.runs === 0) {
    return "bg-slate-800 text-white border border-slate-600";
  }
  return "bg-sky-600 text-white border border-sky-400";
}
