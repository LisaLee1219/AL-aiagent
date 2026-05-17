import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { ensureEnvLoaded } from '@/lib/env-loader';

export async function GET() {
  await ensureEnvLoaded();

  const session = await getSession();

  if (!session) {
    return NextResponse.json({
      success: true,
      data: { authenticated: false },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      authenticated: true,
      username: session.userName || session.username.split('\\').pop() || session.username,
      company: session.companyName,
      odataUrl: session.odataUrl,
      loginAt: session.loginAt,
    },
  });
}
