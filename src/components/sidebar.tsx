'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  ShoppingCart,
  Truck,
  DollarSign,
  Megaphone,
  LayoutDashboard,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const departments = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sales', href: '/sales', icon: Briefcase },
  { name: 'Procurement', href: '/procurement', icon: ShoppingCart },
  { name: 'Logistics', href: '/logistics', icon: Truck },
  { name: 'Finance', href: '/finance', icon: DollarSign },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
];

interface SessionInfo {
  authenticated: boolean;
  username?: string;
  company?: string;
}

interface EmailStatusInfo {
  configured: boolean;
  connected: boolean;
  mailbox?: string;
  tenantId?: string;
  error?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<SessionInfo>({ authenticated: false });
  const [loggingOut, setLoggingOut] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatusInfo>({
    configured: false,
    connected: false,
  });
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSession(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const refreshEmailStatus = async () => {
    setEmailStatusLoading(true);
    try {
      const res = await fetch('/api/emails/status');
      const data = await res.json();
      if (data.success && data.data) {
        setEmailStatus(data.data);
      }
    } catch {
      setEmailStatus({
        configured: false,
        connected: false,
        error: 'Unable to load Outlook connection status.',
      });
    } finally {
      setEmailStatusLoading(false);
    }
  };

  useEffect(() => {
    refreshEmailStatus();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      localStorage.removeItem('bc_session_token');
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-md border bg-muted/50 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm truncate">AI Smart Workspace</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {departments.map((dept) => {
          const isActive = pathname === dept.href;
          const Icon = dept.icon;
          return (
            <Link
              key={dept.href}
              href={dept.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
              {!collapsed && <span className="truncate">{dept.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info & Logout */}
      {session.authenticated && (
        <div className="border-t border-border p-2 space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
                  collapsed ? 'justify-center px-2' : ''
                )}
              >
                <User className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      {session.username && (
                        <div className="font-medium text-foreground text-sm truncate">{session.username}</div>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {emailStatus.connected ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>Outlook connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-amber-600" />
                            <span>{emailStatus.configured ? 'Outlook unavailable' : 'Outlook not connected'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-80">
              <DropdownMenuLabel className="space-y-1">
                <div className="font-medium">{session.username || 'User'}</div>
                {session.company && (
                  <div className="text-xs font-normal text-muted-foreground">{session.company}</div>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="h-4 w-4" />
                    <span>Outlook Mail</span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshEmailStatus}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {emailStatusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                  </button>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {emailStatus.connected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700">Connected</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-700">
                          {emailStatus.configured ? 'Configured but not reachable' : 'Not connected'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mailbox: {emailStatus.mailbox || 'Not configured'}
                  </div>
                  {!emailStatus.connected && (
                    <div className="text-xs text-muted-foreground">
                      {emailStatus.error || 'Set MAIL_TENANT_ID, MAIL_CLIENT_ID, MAIL_CLIENT_SECRET and MAIL_MAILBOX to enable live Outlook mail.'}
                    </div>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors w-full',
              collapsed ? 'justify-center px-2' : ''
            )}
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            ) : (
              <LogOut className="w-4 h-4 flex-shrink-0" />
            )}
            {!collapsed && <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>}
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
