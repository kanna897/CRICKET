"use client";

import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import type { PointsRules, StandingRow, StandingsMatch, StandingsTeam } from "@/lib/tournament-standings";

type Prediction = "team_a" | "tie" | "team_b";

export function QualificationSimulator({ teams, matches, standings, rules = { win: 2, tie: 1, loss: 0 } }: {
  teams: StandingsTeam[];
  matches: StandingsMatch[];
  standings: StandingRow[];
  rules?: PointsRules;
}) {
  const remaining = matches.filter((match) => match.status !== "completed");
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const slots = Math.min(4, Math.max(1, Math.ceil(teams.length / 2)));
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || "Team";

  const projected = useMemo(() => projectTable(standings, remaining, predictions, rules), [predictions, remaining, rules, standings]);
  const probabilities = useMemo(() => qualificationProbabilities(standings, remaining, predictions, rules, slots), [predictions, remaining, rules, slots, standings]);

  if (!teams.length) return null;
  return <section className="overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-gradient-to-r from-violet-500/15 via-primary/10 to-transparent p-5 sm:p-6">
      <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-violet-500"><Sparkles className="h-4 w-4" />Qualification lab</p><h2 className="mt-1 text-xl font-black">Points-table qualification simulator</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Try future match results. Official scores stay unchanged. Top {slots} teams are treated as the qualification zone.</p></div>
      <button type="button" onClick={() => setPredictions({})} disabled={!Object.keys(predictions).length} className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-3 text-sm font-bold disabled:opacity-50"><RotateCcw className="mr-2 h-4 w-4" />Reset</button>
    </div>

    {remaining.length ? <div className="grid gap-3 border-b border-border p-5 lg:grid-cols-2">{remaining.map((match) =>
      <article key={match.id} className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="mb-3 text-[.65rem] font-black uppercase tracking-wider text-muted-foreground">Remaining fixture</p>
        <div className="grid grid-cols-[minmax(0,1fr)_4.25rem_minmax(0,1fr)] items-stretch gap-2">
          <OutcomeButton active={predictions[match.id] === "team_a"} label={teamName(match.team_a_id)} onClick={() => setPredictions({ ...predictions, [match.id]: "team_a" })} />
          <OutcomeButton active={predictions[match.id] === "tie"} label="Tie / NR" onClick={() => setPredictions({ ...predictions, [match.id]: "tie" })} />
          <OutcomeButton active={predictions[match.id] === "team_b"} label={teamName(match.team_b_id)} onClick={() => setPredictions({ ...predictions, [match.id]: "team_b" })} />
        </div>
      </article>
    )}</div> : <p className="border-b border-border p-5 text-sm text-muted-foreground">All scheduled fixtures are completed. Current standings are the final projection.</p>}

    <div className="p-5">
      <div className="mb-3 flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /><h3 className="font-black">Projected qualification table</h3></div>
      <div className="overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-muted/60 text-[.68rem] font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Rank</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Projected pts</th><th className="pr-4 text-right">Qualification chance</th></tr></thead>
        <tbody>{projected.map((row, index) => {
          const chance = probabilities.get(row.team_id) || 0;
          return <tr key={row.team_id} className={`border-t border-border ${index < slots ? "bg-emerald-500/[.06]" : ""}`}><td className="px-4 py-3 font-black text-primary">#{index + 1}</td><td><span className="flex items-center gap-2 font-bold">{index < slots && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}{teamName(row.team_id)}</span></td><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td><td>{row.tied}</td><td className="text-lg font-black">{row.points}</td><td className="pr-4 text-right"><span className={`inline-flex min-w-16 justify-center rounded-full px-2.5 py-1 text-xs font-black ${chance >= 75 ? "bg-emerald-500/15 text-emerald-600" : chance >= 35 ? "bg-amber-500/15 text-amber-600" : "bg-rose-500/15 text-rose-600"}`}>{chance.toFixed(0)}%</span></td></tr>;
        })}</tbody>
      </table></div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Probability checks every possible result when fixtures are small; larger schedules use a deterministic 2,000-scenario model. NRR remains at its current value because future run margins are unknown.</p>
    </div>
  </section>;
}

function OutcomeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-14 h-full min-w-0 items-center justify-center break-words rounded-xl border px-2 py-2 text-center text-xs font-black leading-tight transition ${active ? "border-primary bg-primary text-primary-foreground shadow-lg" : "border-border bg-background text-foreground hover:border-primary/60"}`}>{label}</button>;
}

function projectTable(base: StandingRow[], remaining: StandingsMatch[], predictions: Record<string, Prediction>, rules: PointsRules) {
  const rows = new Map(base.map((row) => [row.team_id, { ...row }]));
  for (const match of remaining) {
    const outcome = predictions[match.id]; if (!outcome) continue;
    applyOutcome(rows, match, outcome, rules);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won);
}

function applyOutcome(rows: Map<string, StandingRow>, match: StandingsMatch, outcome: Prediction, rules: PointsRules) {
  const a = rows.get(match.team_a_id), b = rows.get(match.team_b_id); if (!a || !b) return;
  a.played++; b.played++;
  if (outcome === "team_a") { a.won++; b.lost++; a.points += rules.win; b.points += rules.loss; }
  else if (outcome === "team_b") { b.won++; a.lost++; b.points += rules.win; a.points += rules.loss; }
  else { a.tied++; b.tied++; a.points += rules.tie; b.points += rules.tie; }
}

function qualificationProbabilities(base: StandingRow[], remaining: StandingsMatch[], locked: Record<string, Prediction>, rules: PointsRules, slots: number) {
  const open = remaining.filter((match) => !locked[match.id]);
  const counts = new Map(base.map((row) => [row.team_id, 0]));
  const totalExact = 3 ** open.length;
  const iterations = totalExact <= 6561 ? totalExact : 2000;
  for (let index = 0; index < iterations; index++) {
    const outcomes = { ...locked };
    let cursor = index;
    for (let fixture = 0; fixture < open.length; fixture++) {
      const pick = totalExact <= 6561 ? cursor % 3 : pseudoRandom(index * 97 + fixture * 31) % 3;
      outcomes[open[fixture].id] = (["team_a", "tie", "team_b"] as Prediction[])[pick];
      cursor = Math.floor(cursor / 3);
    }
    projectTable(base, remaining, outcomes, rules).slice(0, slots).forEach((row) => counts.set(row.team_id, (counts.get(row.team_id) || 0) + 1));
  }
  return new Map([...counts].map(([id, count]) => [id, iterations ? count * 100 / iterations : 0]));
}
function pseudoRandom(seed: number) { const value = Math.sin(seed + 1) * 10000; return Math.floor((value - Math.floor(value)) * 100000); }
