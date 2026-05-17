'use client';

import { useEffect, useState, useCallback } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('/');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from && from !== '/login') {
      setRedirectUrl(from);
    }
    // Do NOT auto-redirect even if token exists in localStorage.
    // If user is already logged in (cookie valid), the middleware
    // will let them through to / directly — they won't even see /login.
    // If they manually navigate to /login, they want to re-login.
  }, []);

  const redirectWithSession = useCallback((token: string, target: string) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/redirect';
    form.style.display = 'none';

    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token';
    tokenInput.value = token;

    const redirectInput = document.createElement('input');
    redirectInput.type = 'hidden';
    redirectInput.name = 'redirect';
    redirectInput.value = target || '/';

    form.appendChild(tokenInput);
    form.appendChild(redirectInput);
    document.body.appendChild(form);
    form.submit();
  }, []);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Connecting to Business Central...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.success && data.token) {
        setStatus('Login successful! Redirecting...');

        // Keep a client-side fallback token for API requests patched by AuthProvider.
        localStorage.setItem('bc_session_token', data.token);

        // Complete the login with a server-side redirect so the session cookie
        // is committed before middleware checks the next page request.
        redirectWithSession(data.token, redirectUrl);
      } else {
        setError(data.error || 'Login failed');
        setStatus('');
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Connection timed out. Business Central server may be unreachable.');
      } else {
        setError('Network error. Please check your connection.');
      }
      setStatus('');
      setLoading(false);
    }
  }, [username, password, redirectUrl, redirectWithSession]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin();
    }
  }, [handleLogin, loading]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        padding: 40,
        margin: 20,
      }}>
        {/* Logo Area */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28, color: 'white', fontWeight: 'bold',
          }}>A</div>
          <h1 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
            Allinton Smart Office
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            Sign in with your Business Central credentials
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: 32,
          border: '1px solid #334155',
        }}>
          {/* Username */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="DOMAIN\USERNAME"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: '#0f172a', border: '1px solid #475569',
                color: '#f8fafc', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Enter password"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: '#0f172a', border: '1px solid #475569',
                color: '#f8fafc', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#7f1d1d', border: '1px solid #dc2626',
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Status */}
          {status && !error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#1e3a5f', border: '1px solid #3b82f6',
              color: '#93c5fd', fontSize: 13,
            }}>
              {status}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 8,
              background: loading ? '#475569' : '#2563eb',
              color: loading ? '#94a3b8' : '#ffffff',
              fontSize: 15, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Help Text */}
          <p style={{
            textAlign: 'center', color: '#64748b', fontSize: 12,
            marginTop: 20, marginBottom: 0,
          }}>
            Use your Business Central Windows credentials
          </p>
        </div>
      </div>
    </div>
  );
}
