import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { errorDetails, log } from "./logger";
import { requestIdFrom } from "./request-id";

type RouteHandler<TRequest extends Request = Request, TContext = unknown> =
  (request: TRequest, context: TContext) => Promise<Response>;

export function withApiMonitoring<TRequest extends Request = Request, TContext = unknown>(
  route: string,
  handler: RouteHandler<TRequest, TContext>,
): RouteHandler<TRequest, TContext> {
  return async (request, context) => {
    const startedAt = performance.now();
    const requestId = requestIdFrom(request);
    log("info", "api.request.started", { requestId, route, method: request.method });
    try {
      const response = await handler(request, context);
      response.headers.set("x-request-id", requestId);
      log(response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info", "api.request.completed", {
        requestId,
        route,
        method: request.method,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return response;
    } catch (error) {
      Sentry.captureException(error, { tags: { route, request_id: requestId } });
      log("error", "api.request.failed", {
        requestId,
        route,
        method: request.method,
        durationMs: Math.round(performance.now() - startedAt),
        ...errorDetails(error),
      });
      return NextResponse.json({ error: "Internal server error", requestId }, {
        status: 500,
        headers: { "x-request-id": requestId },
      });
    }
  };
}
