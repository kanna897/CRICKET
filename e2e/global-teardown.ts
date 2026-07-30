import { existsSync, unlinkSync } from "node:fs";
import { fullE2EEnabled } from "./support/env";
import { cleanupE2E } from "./support/seed";
import { readState, statePath } from "./support/state";

export default async function globalTeardown() {
  if (!fullE2EEnabled() || !existsSync(statePath)) return;
  await cleanupE2E(readState());
  unlinkSync(statePath);
}
