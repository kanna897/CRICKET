export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const REDACTED_KEYS = /authorization|cookie|password|secret|token|key|captcha/i;

function sanitize(context: LogContext): LogContext {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [
    key,
    REDACTED_KEYS.test(key) ? "[REDACTED]" : value,
  ]));
}

export function log(level: LogLevel, message: string, context: LogContext = {}) {
  if (level === "debug" && process.env.MONITOR_LOG_LEVEL !== "debug") return;
  const entry = JSON.stringify({
    level,
    message,
    service: "crickpulse",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    ...sanitize(context),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export function errorDetails(error: unknown) {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
    : { errorMessage: String(error) };
}
