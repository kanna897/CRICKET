import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ta', 'si'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  // First run the intl middleware
  const response = intlMiddleware(request);

  // Do not refresh or validate the Supabase token from middleware. The Edge
  // runtime can repeatedly retry that network request and stall local page
  // loads. Client-side Supabase calls and RLS still enforce the real access.
  const hasAuthCookie = request.cookies.getAll().some(({ name }) =>
    name.startsWith('sb-') && name.includes('auth-token')
  );

  const isProtectedPath = request.nextUrl.pathname.includes('/admin') || request.nextUrl.pathname.includes('/scoring');
  
  if (isProtectedPath && !hasAuthCookie) {
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
