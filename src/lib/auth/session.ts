import { cookies, headers } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

const SESSION_COOKIE_NAME = 'bc_session';
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

export interface SessionData {
  username: string;
  password: string;
  odataUrl: string;
  companyId: string;
  loginAt: number;
  userName?: string;
  companyName?: string;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET?.trim() || 'bc-session-dev-secret-change-in-production';
  return new TextEncoder().encode(secret.substring(0, 32).padEnd(32, '0'));
}

export async function createSession(data: SessionData): Promise<string> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE)
    .sign(getSecretKey());
  return token;
}

/**
 * Verify and decode a session JWT token.
 */
async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

/**
 * Get the current session from cookies or Authorization header.
 * Works in API routes (full Node.js runtime with env vars).
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    // 1. Try cookie first
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (cookieToken) {
      const session = await verifyToken(cookieToken);
      if (session) return session;
    }

    // 2. Try Authorization header (Bearer token from localStorage)
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await verifyToken(token);
      if (session) return session;
    }

    return null;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  const isProd = process.env.COZE_PROJECT_ENV === 'PROD';

  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

export function getClearCookieOptions() {
  const isProd = process.env.COZE_PROJECT_ENV === 'PROD';

  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
