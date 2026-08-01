import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const generated = readFileSync(path.join(root, "types", "database.types.ts"), "utf8");

function keysBetween(start, end) {
  const section = generated.slice(generated.indexOf(start), generated.indexOf(end));
  return new Set([...section.matchAll(/^      ([a-z][a-z0-9_]*): \{$/gm)].map((match) => match[1]));
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return files.flat();
}

test("all Supabase table and RPC query names exist in generated live-schema types", async () => {
  const tables = keysBetween("    Tables: {", "    Views: {");
  const functions = keysBetween("    Functions: {", "    Enums: {");
  const files = (await Promise.all(
    ["app", "components", "features", "hooks", "lib", "services"]
      .map((directory) => sourceFiles(path.join(root, directory))),
  )).flat();

  const missing = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const match of source.matchAll(/\.(from|rpc)\(\s*["']([^"']+)["']/g)) {
      const available = match[1] === "from" ? tables : functions;
      if (!available.has(match[2])) {
        missing.push(`${path.relative(root, file)}: ${match[1]}("${match[2]}")`);
      }
    }
  }

  assert.deepEqual(missing, []);
});
