import { NextResponse } from 'next/server';
import { getClearCookieOptions } from '@/lib/auth/session';

export async function POST() {
  const cookieOptions = getClearCookieOptions();
  const response = NextResponse.json({ success: true });

  response.cookies.set(cookieOptions.name, cookieOptions.value, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    maxAge: cookieOptions.maxAge,
  });

  return response;
}
