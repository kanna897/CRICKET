export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id")
    || request.headers.get("x-vercel-id")
    || crypto.randomUUID();
}
