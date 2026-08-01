import type { AuctionPlayer } from "./types";

export function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function money(value: number) {
  return new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(value || 0);
}

export function displaySerial(player: AuctionPlayer) {
  return player.ocr_serial_number || player.registration_number;
}

export function playerDetailsFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  const parts = base.split(/\s+(?:-|–|—)\s+|_+/).map((part) => part.trim()).filter(Boolean);
  const serialPart = parts.length && /^\d+$/.test(parts[0]) ? parts.shift()! : "";
  const rolePattern = /^(all[\s_-]?rounder|batsman|batter|bowler|wicket[\s_-]?keeper|player)$/i;
  const rolePart = parts.length > 1 && rolePattern.test(parts.at(-1) || "") ? parts.pop()! : "Player";
  const playerName = parts.join(" - ").trim() || base.replace(/^\d+\s*/, "").trim() || "Player";
  return {
    registration_number: serialPart ? Number(serialPart) : undefined,
    player_name: playerName,
    playing_role: rolePart.replaceAll("-", " ").replaceAll("_", " "),
  };
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()));
  return results;
}
