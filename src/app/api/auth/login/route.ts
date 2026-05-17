import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';
import { ensureEnvLoaded } from '@/lib/env-loader';

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Determine BC OData URL — from env or default
    const odataUrl = process.env.BC_ODATA_URL || 'http://businesscentral.allinton.com.sg:17048/BC180/ODataV4';

    // Step 1: Validate credentials by trying to fetch companies from BC
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    let companyId = process.env.BC_COMPANY_ID || '';
    let companyName = '';
    let bcConnected = false;

    try {
      // Try to fetch companies to validate credentials
      const companyRes = await fetch(`${odataUrl}/Company`, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!companyRes.ok) {
        if (companyRes.status === 401) {
          return NextResponse.json(
            { success: false, error: 'Invalid username or password' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { success: false, error: `Business Central returned status ${companyRes.status}` },
          { status: 502 }
        );
      }

      const companyData = await companyRes.json();
      const companies: Array<{ Id: string; Name: string; DisplayName: string }> = companyData.value || [];

      if (companies.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No companies found in Business Central' },
          { status: 404 }
        );
      }

      // Use the first company if not pre-configured
      if (!companyId) {
        companyId = companies[0].Id;
      }

      const matchedCompany = companies.find(c => c.Id === companyId);
      companyName = matchedCompany?.DisplayName || matchedCompany?.Name || companies[0].Name;
      bcConnected = true;

    } catch (err) {
      // If BC is unreachable, allow login with degraded mode
      const isNetworkError = err instanceof TypeError || 
        (err instanceof Error && (
          err.message.includes('fetch') || 
          err.message.includes('ECONNREFUSED') || 
          err.message.includes('timeout') || 
          err.message.includes('ENOTFOUND') ||
          err.message.includes('aborted')
        ));
      
      if (!isNetworkError) {
        throw err;
      }
      
      companyId = process.env.BC_COMPANY_ID || '';
      companyName = 'BC Unavailable';
      bcConnected = false;
    }

    // Step 2: Create encrypted session with BC credentials
    const sessionToken = await createSession({
      username,
      password,
      odataUrl,
      companyId,
      loginAt: Date.now(),
      userName: username.split('\\').pop() || username,
      companyName: companyName || undefined,
    });

    // Step 3: Set session cookie AND return token in body
    const cookieOptions = getSessionCookieOptions();
    const response = NextResponse.json({
      success: true,
      data: {
        username: username.split('\\').pop() || username,
        company: companyName,
        odataUrl,
        bcConnected,
      },
      token: sessionToken, // Also return as JSON for localStorage fallback
    });

    response.cookies.set(cookieOptions.name, sessionToken, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
