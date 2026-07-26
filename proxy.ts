import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

const intlProxy = createMiddleware({
  locales: ["en", "ta", "si"],
  defaultLocale: "en",
  localePrefix: "always",
});

export async function proxy(request: NextRequest) {
  let response = intlProxy(request);
  const isAdminRequest = /^\/(?:en|ta|si)\/admin(?:\/|$)/.test(request.nextUrl.pathname);
  if (!isAdminRequest) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = intlProxy(request);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );

  // Refresh an existing session. Authorization is still enforced in the
  // protected Server Component and by Postgres RLS, never by Proxy alone.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Apply locale routing to every application page while leaving assets,
    // Next.js internals and API routes untouched.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|push-handler.js|.*\\..*).*)",
  ],
};
