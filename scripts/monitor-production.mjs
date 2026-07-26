const baseUrl = process.env.PRODUCTION_URL?.trim().replace(/\/+$/, "");
if (!baseUrl) {
  console.error("PRODUCTION_URL is not configured.");
  process.exit(1);
}

const checks = [];

async function check(name, path, validate) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { "User-Agent": "CrickPulse-Production-Monitor/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await response.text();
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await validate(body, response);
    checks.push({ name, status: "ok", latencyMs });
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await check("health", "/api/health", async (body, response) => {
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Health endpoint did not return JSON.");
    }
    const payload = JSON.parse(body);
    if (payload.status !== "ok" || payload.database !== "ok") {
      throw new Error(`Health degraded: ${JSON.stringify(payload)}`);
    }
    if (!payload.timestamp || !payload.version) {
      throw new Error("Health payload is missing timestamp or version.");
    }
  });
  await check("landing", "/en", async (body) => {
    if (!body.includes("CrickPulse") && !body.includes("CRICKPULSE")) {
      throw new Error("Landing page signature was not found.");
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(JSON.stringify({ baseUrl, checks }));
  process.exit(1);
}

console.log(JSON.stringify({ baseUrl, checkedAt: new Date().toISOString(), checks }, null, 2));
