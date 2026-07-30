import { after, NextResponse } from "next/server";
import { log } from "@/lib/monitoring/logger";
import { requestIdFrom } from "@/lib/monitoring/request-id";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckStatus = "ok" | "unavailable" | "misconfigured";

async function timedCheck(url: string, headers: HeadersInit) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return { status: response.ok ? "ok" as const : "unavailable" as const, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "unavailable" as const, latencyMs: Math.round(performance.now() - startedAt) };
  }
}

async function sendHealthAlert(payload: Record<string, unknown>) {
  const webhook = process.env.MONITOR_ALERT_WEBHOOK;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.MONITOR_ALERT_TOKEN ? { authorization: `Bearer ${process.env.MONITOR_ALERT_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    log("error", "health.alert.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  }
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = requestIdFrom(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let database: { status: CheckStatus; latencyMs: number | null } = { status: "misconfigured", latencyMs: null };
  let realtime: { status: CheckStatus; latencyMs: number | null } = { status: "misconfigured", latencyMs: null };

  if (supabaseUrl && supabaseKey) {
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
    [database, realtime] = await Promise.all([
      timedCheck(`${supabaseUrl}/rest/v1/tournaments?select=id&limit=1`, headers),
      timedCheck(`${supabaseUrl}/realtime/v1/api/health`, headers),
    ]);
  }

  const healthy = database.status === "ok" && realtime.status === "ok";
  const payload = {
    status: healthy ? "ok" : "degraded",
    service: "crickpulse",
    checks: { database, realtime, sentry: process.env.SENTRY_DSN ? "configured" : "disabled" },
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || "development",
    requestId,
  };
  log(healthy ? "info" : "error", "health.checked", payload);
  if (!healthy) after(() => sendHealthAlert(payload));

  return NextResponse.json(payload, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "x-request-id": requestId,
    },
  });
}
