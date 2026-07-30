import * as Sentry from "@sentry/nextjs";
import { errorDetails, log } from "./logger";

const SLOW_QUERY_MS = Number(process.env.MONITOR_SLOW_DB_MS || 1000);

export async function monitorDatabaseOperation<T>(operation: string, task: () => PromiseLike<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await task();
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= SLOW_QUERY_MS) {
      log("warn", "database.operation.slow", { operation, durationMs });
      Sentry.captureMessage(`Slow database operation: ${operation}`, {
        level: "warning",
        tags: { subsystem: "database", operation },
        extra: { durationMs },
      });
    }
    return result;
  } catch (error) {
    log("error", "database.operation.failed", { operation, ...errorDetails(error) });
    Sentry.captureException(error, { tags: { subsystem: "database", operation } });
    throw error;
  }
}
