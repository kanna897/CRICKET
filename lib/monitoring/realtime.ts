"use client";

import * as Sentry from "@sentry/nextjs";
import type { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

export function subscribeWithMonitoring(channel: RealtimeChannel, name: string) {
  const startedAt = performance.now();
  return channel.subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`, error?: Error) => {
    if (status === "SUBSCRIBED") {
      if (process.env.NODE_ENV !== "production") {
        console.debug(JSON.stringify({ level: "debug", message: "realtime.connected", channel: name, durationMs: Math.round(performance.now() - startedAt) }));
      }
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(JSON.stringify({ level: "error", message: "realtime.connection.failed", channel: name, status, error: error?.message }));
      Sentry.captureMessage(`Realtime ${status.toLowerCase()}: ${name}`, {
        level: "error",
        tags: { subsystem: "realtime", channel: name, status },
        extra: { error: error?.message },
      });
    }
  });
}
