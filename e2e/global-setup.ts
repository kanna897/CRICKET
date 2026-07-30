import { mkdirSync } from "node:fs";
import path from "node:path";
import { fullE2EEnabled } from "./support/env";
import { seedE2E } from "./support/seed";
import { writeState } from "./support/state";

export default async function globalSetup() {
  if (!fullE2EEnabled()) return;
  mkdirSync(path.resolve(process.cwd(), "tmp"), { recursive: true });
  writeState(await seedE2E());
}
