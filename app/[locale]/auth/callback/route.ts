import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = new URL(`/${locale}/admin`, requestUrl.origin);
  const response = NextResponse.redirect(destination);

  if (!code) {
    destination.pathname = `/${locale}/login`;
    destination.searchParams.set("error", "missing_confirmation_code");
    return NextResponse.redirect(destination);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    destination.pathname = `/${locale}/login`;
    destination.searchParams.set("error", "confirmation_failed");
    return NextResponse.redirect(destination);
  }

  return response;
}
