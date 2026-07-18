import createMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ta', 'si'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  // First run the intl middleware
  const response = intlMiddleware(request);

  // Then add supabase auth protection
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const isProtectedPath = request.nextUrl.pathname.includes('/admin') || request.nextUrl.pathname.includes('/scoring');
  
  if (isProtectedPath && !session) {
    const redirectUrl = request.nextUrl.clone();
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/');
    const locale = ['en', 'ta', 'si'].includes(segments[1]) ? segments[1] : 'en';
    
    redirectUrl.pathname = `/${locale}/login`;
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ta|si|en)/:path*', '/admin/:path*', '/scoring/:path*']
};
