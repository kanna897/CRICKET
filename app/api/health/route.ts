import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = performance.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let database: "ok" | "unavailable" | "misconfigured" = "misconfigured";

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/tournaments?select=id&limit=1`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      database = response.ok ? "ok" : "unavailable";
    } catch {
      database = "unavailable";
    }
  }

  const healthy = database === "ok";
  return NextResponse.json({
    status: healthy ? "ok" : "degraded",
    service: "crickpulse",
    database,
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || "development",
  }, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff" },
  });
}
