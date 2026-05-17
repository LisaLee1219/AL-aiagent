import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const redirect = (formData.get('redirect') as string) || '/';

    if (!token) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: new URL('/login?error=missing_token', request.url).toString() },
    });
    }

    // The token IS the JWT we issued during login.
    // We need to set it as a cookie on the redirect response.
    // Parse the JWT to get the session data (it's already signed)
    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    const isHTTPS = isProd;

    const redirectUrl = new URL(redirect, request.url);
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: redirectUrl.toString() },
    });
    response.cookies.set('bc_session', token, {
      httpOnly: true,
      secure: isHTTPS,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: new URL('/login?error=redirect_failed', request.url).toString() },
    });
  }
}
