import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type E2EState = {
  runId: string;
  users: { admin: string; organizer: string; scorer: string };
  tournamentId: string;
  teamIds: [string, string];
  playerIds: [string, string, string, string];
  matchId: string;
};

export const statePath = path.resolve(process.cwd(), "tmp", "e2e-state.json");

export function readState(): E2EState {
  if (!existsSync(statePath)) throw new Error("E2E seed state is missing. Run Playwright global setup.");
  return JSON.parse(readFileSync(statePath, "utf8")) as E2EState;
}

export function writeState(state: E2EState) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
