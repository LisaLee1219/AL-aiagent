'use client';

import { useEffect } from 'react';

/**
 * AuthProvider: intercepts all fetch requests to add the Authorization header
 * from localStorage. This ensures all API calls carry the session token
 * even if the httpOnly cookie is blocked by the browser.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      // Only intercept API calls to our own server
      if (url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/')) {
        const token = localStorage.getItem('bc_session_token');

        if (token) {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${token}`);

          init = {
            ...init,
            headers,
          };
        }
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}
