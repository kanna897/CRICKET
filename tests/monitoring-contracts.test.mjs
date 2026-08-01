import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("production monitoring initializes Sentry without collecting PII", () => {
  const server = read("sentry.server.config.ts");
  const client = read("instrumentation-client.ts");
  const instrumentation = read("instrumentation.ts");
  assert.match(server, /sendDefaultPii:\s*false/);
  assert.match(client, /sendDefaultPii:\s*false/);
  assert.match(instrumentation, /captureRequestError/);
  assert.match(client, /captureRouterTransitionStart/);
});

test("API monitoring emits structured logs and request IDs", () => {
  const api = read("lib/monitoring/api.ts");
  const logger = read("lib/monitoring/logger.ts");
  assert.match(api, /x-request-id/);
  assert.match(api, /api\.request\.started/);
  assert.match(api, /api\.request\.completed/);
  assert.match(api, /captureException/);
  assert.match(logger, /JSON\.stringify/);
  assert.match(logger, /REDACTED_KEYS/);
});

test("health monitoring covers database, realtime, alerts and versioning", () => {
  const health = read("app/api/health/route.ts");
  assert.match(health, /realtime\/v1\/api\/broadcast\/crickpulse-health\/events\/probe/);
  assert.match(health, /method: "POST", body: JSON\.stringify\(\{ probe: "health" \}\)/);
  assert.match(health, /"content-type": "application\/json"/);
  assert.doesNotMatch(health, /realtime\/v1\/api\/health/);
  assert.doesNotMatch(health, /new WebSocket|\.channel\(|\.subscribe\(/);
  assert.match(health, /MONITOR_ALERT_WEBHOOK/);
  assert.match(health, /after\(/);
  assert.match(health, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(health, /x-request-id/);
});

test("database and realtime monitoring stay on slow and error paths", () => {
  const database = read("lib/monitoring/database.ts");
  const realtime = read("lib/monitoring/realtime.ts");
  assert.match(database, /database\.operation\.slow/);
  assert.match(database, /database\.operation\.failed/);
  assert.match(realtime, /CHANNEL_ERROR/);
  assert.match(realtime, /TIMED_OUT/);
  assert.match(realtime, /realtime\.connection\.failed/);
});
