import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/redirect', '/api/auth/session'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Check for session cookie
  const hasCookie = request.cookies.get('bc_session')?.value;

  // Special handling for /login page
  if (pathname === '/login') {
    if (hasCookie) {
      // Already logged in → redirect to dashboard
      const from = request.nextUrl.searchParams.get('from') || '/';
      return NextResponse.redirect(new URL(from, request.url));
    }
    // Not logged in → show login page
    return NextResponse.next();
  }

  // Allow public API paths (login, logout, redirect, session)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (hasCookie) {
    return NextResponse.next();
  }

  // Not authenticated
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Redirect to login page with return URL
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
