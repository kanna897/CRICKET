import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

for (const filename of [".env.local", ".env"]) {
  const target = path.resolve(process.cwd(), filename);
  if (!existsSync(target)) continue;
  for (const line of readFileSync(target, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

export const fullE2EEnabled = () => process.env.E2E_RUN_FULL === "true";

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when E2E_RUN_FULL=true`);
  return value;
}
