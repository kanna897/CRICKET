export type HistoricalScoreRow = {
  match_ref: string;
  match_date: string;
  team_a: string;
  team_b: string;
  winner: string;
  innings_number: number;
  batting_team: string;
  total_runs: number;
  total_wickets: number;
  balls_bowled: number;
  team_a_id?: string;
  team_b_id?: string;
  winner_id?: string;
  batting_team_id?: string;
};

export type HistoricalMatchGroup = {
  matchRef: string;
  matchDate: string;
  teamA: string;
  teamB: string;
  winner: string;
  innings: HistoricalScoreRow[];
  errors: string[];
};

const requiredHeaders = ["match_ref", "match_date", "team_a", "team_b", "winner", "innings_number", "batting_team", "total_runs", "total_wickets", "balls_bowled"];

export function parseHistoricalScores(content: string, filename = ""): HistoricalScoreRow[] {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("The selected file is empty.");
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("This is not valid JSON. Check for missing commas, quotes or brackets and try again.");
    }
    const rows = extractJsonRows(parsed);
    return rows.flatMap(expandJsonRow).map(normalizeRow);
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const headers = lines.shift()?.map((header) => header.trim().toLowerCase()) || [];
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}`);
  return lines.map((values) => normalizeRow(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))));
}

export function groupHistoricalScores(rows: HistoricalScoreRow[]): HistoricalMatchGroup[] {
  const groups = new Map<string, HistoricalScoreRow[]>();
  rows.forEach((row) => groups.set(row.match_ref, [...(groups.get(row.match_ref) || []), row]));
  return [...groups.entries()].map(([matchRef, innings]) => {
    const first = innings[0];
    const errors: string[] = [];
    if (!matchRef) errors.push("Match reference is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first.match_date) || Number.isNaN(Date.parse(first.match_date))) errors.push("Match date must use YYYY-MM-DD.");
    if (!first.team_a || !first.team_b || sameName(first.team_a, first.team_b)) errors.push("Two different team names are required.");
    if (!first.winner || ![first.team_a, first.team_b, "tie", "no result"].some((value) => sameName(value, first.winner))) errors.push("Winner must match Team A, Team B, Tie or No Result.");
    if (innings.length < 1 || innings.length > 2) errors.push("Each match needs one or two innings rows.");
    if (new Set(innings.map((row) => row.innings_number)).size !== innings.length) errors.push("Innings numbers must be unique.");
    innings.forEach((row) => {
      if (![1, 2].includes(row.innings_number)) errors.push("Innings number must be 1 or 2.");
      if (![first.team_a, first.team_b].some((team) => sameName(team, row.batting_team))) errors.push(`Unknown batting team: ${row.batting_team || "blank"}.`);
      if (row.total_runs < 0 || row.total_wickets < 0 || row.total_wickets > 10 || row.balls_bowled < 0) errors.push(`Invalid score in innings ${row.innings_number}.`);
    });
    return { matchRef, matchDate: first.match_date, teamA: first.team_a, teamB: first.team_b, winner: first.winner, innings: [...innings].sort((a, b) => a.innings_number - b.innings_number), errors: [...new Set(errors)] };
  });
}

export function historicalSampleCsv() {
  return `${requiredHeaders.join(",")}\nMATCH-001,2026-07-01,Eagles Cricket Club,Mylankadu Gnanamurugan,Eagles Cricket Club,1,Eagles Cricket Club,145,6,120\nMATCH-001,2026-07-01,Eagles Cricket Club,Mylankadu Gnanamurugan,Eagles Cricket Club,2,Mylankadu Gnanamurugan,138,9,120\n`;
}

export function normalizeName(value: string) { return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " "); }
export function sameName(a: string, b: string) { return normalizeName(a) === normalizeName(b); }

function normalizeRow(input: Record<string, unknown>): HistoricalScoreRow {
  const overs = input.overs ?? input.overs_completed ?? input.oversCompleted;
  return {
    match_ref: String(input.match_ref || input.matchRef || input.match_id || input.matchId || "").trim(),
    match_date: String(input.match_date || input.matchDate || input.date || "").trim(),
    team_a: String(input.team_a || input.teamA || "").trim(),
    team_b: String(input.team_b || input.teamB || "").trim(),
    winner: String(input.winner || "").trim(),
    innings_number: Number(input.innings_number ?? input.inningsNumber),
    batting_team: String(input.batting_team || input.battingTeam || "").trim(),
    total_runs: Number(input.total_runs ?? input.totalRuns ?? input.runs),
    total_wickets: Number(input.total_wickets ?? input.totalWickets ?? input.wickets),
    balls_bowled: Number(input.balls_bowled ?? input.ballsBowled ?? (overs == null ? undefined : oversToBalls(overs))),
    team_a_id: String(input.team_a_id || input.teamAId || "").trim() || undefined,
    team_b_id: String(input.team_b_id || input.teamBId || "").trim() || undefined,
    winner_id: String(input.winner_id || input.winnerId || "").trim() || undefined,
    batting_team_id: String(input.batting_team_id || input.battingTeamId || "").trim() || undefined,
  };
}

function extractJsonRows(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.filter(isJsonObject);
  if (!isJsonObject(input)) throw new Error("JSON must contain match score objects.");

  for (const key of ["rows", "records", "matches"]) {
    if (Array.isArray(input[key])) return (input[key] as unknown[]).filter(isJsonObject);
  }
  if (Array.isArray(input.data)) return input.data.filter(isJsonObject);
  if (isJsonObject(input.data)) return extractJsonRows(input.data);

  const looksLikeMatch = ["match_ref", "matchRef", "match_id", "matchId", "team_a", "teamA", "innings"].some((key) => key in input);
  if (looksLikeMatch) return [input];
  throw new Error('JSON format not recognized. Use an array, {"rows":[...]}, {"data":[...]}, {"records":[...]} or {"matches":[...]}.');
}

function expandJsonRow(input: Record<string, unknown>): Record<string, unknown>[] {
  if (isJsonObject(input.innings)) return [{ ...input, ...input.innings, innings: undefined }];
  if (!Array.isArray(input.innings)) return [input];
  return input.innings.filter(isJsonObject).map((innings) => ({ ...input, ...innings, innings: undefined }));
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function oversToBalls(value: unknown) {
  const [overs = "0", balls = "0"] = String(value ?? "0").split(".");
  return Math.max(Number.parseInt(overs, 10) || 0, 0) * 6 + Math.min(Math.max(Number.parseInt(balls, 10) || 0, 0), 5);
}

function parseCsvLine(line: string) {
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { current += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += character;
  }
  values.push(current.trim()); return values;
}
