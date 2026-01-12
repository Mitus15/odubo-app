'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface PlatformInfo {
  platform: string;
  displayName: string;
  icon: string;
  color: string;
  available: boolean;
  requiresApproval: boolean;
  configured: boolean;
  connected: boolean;
  connection: {
    id: string;
    accountName: string;
    status: string;
    lastSync: string | null;
    lastError: string | null;
  } | null;
}

interface ConnectionsData {
  connections: any[];
  platforms: PlatformInfo[];
}

export default function PlatformConnections() {
  const [data, setData] = useState<ConnectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchData();

    // Check for success/error from OAuth callback
    const connected = searchParams?.get('connected');
    const account = searchParams?.get('account');
    const error = searchParams?.get('error');

    if (connected && account) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${connected}: ${account}`,
      });
      // Clean URL
      window.history.replaceState({}, '', '/admin?tab=intel-connections');
    } else if (error) {
      setNotification({
        type: 'error',
        message: error,
      });
      window.history.replaceState({}, '', '/admin?tab=intel-connections');
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/connections');
      const result: ConnectionsData = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectPlatform = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch('/api/connections/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const result: { success?: boolean; authUrl?: string; error?: string } = await res.json();

      if (result.authUrl) {
        // Redirect to OAuth
        window.location.href = result.authUrl;
      } else if (result.error) {
        setNotification({ type: 'error', message: result.error });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to initiate connection',
      });
    } finally {
      setConnecting(null);
    }
  };

  const disconnectPlatform = async (platform: string) => {
    if (!confirm('Are you sure you want to disconnect this platform?')) return;

    try {
      const res = await fetch('/api/connections/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const result: { success?: boolean; message?: string; error?: string } = await res.json();

      if (result.success) {
        setNotification({ type: 'success', message: result.message || 'Disconnected' });
        fetchData();
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to disconnect' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to disconnect' });
    }
  };

  const syncPlatform = async (platform: string) => {
    setSyncing(platform);
    try {
      const res = await fetch('/api/connections/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const result: { success?: boolean; message?: string; error?: string } = await res.json();

      if (result.success) {
        setNotification({
          type: 'success',
          message: result.message || 'Sync completed',
        });
        fetchData();
      } else {
        setNotification({ type: 'error', message: result.error || 'Sync failed' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Sync failed' });
    } finally {
      setSyncing(null);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      case 'expired':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPlatformIcon = (icon: string) => {
    const icons: Record<string, React.ReactNode> = {
      youtube: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
      instagram: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      tiktok: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      ),
      spotify: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      ),
      twitter: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    };
    return icons[icon] || <div className="w-6 h-6 bg-white/20 rounded" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-white/60">Loading platforms...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Platform Connections</h1>
          <p className="text-white/60 text-sm mt-1">
            Connect your accounts to sync analytics data
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-current hover:opacity-70"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.platforms.map((platform) => (
          <div
            key={platform.platform}
            className="bg-white/5 rounded-xl p-5 border border-white/10"
          >
            {/* Platform Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${platform.color}20`, color: platform.color }}
              >
                {getPlatformIcon(platform.icon)}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{platform.displayName}</h3>
                {platform.connection && (
                  <p className="text-sm text-white/60">
                    {platform.connection.accountName}
                  </p>
                )}
              </div>
              {platform.connection && (
                <span
                  className={`text-xs px-2 py-1 rounded ${getStatusBadge(
                    platform.connection.status
                  )}`}
                >
                  {platform.connection.status}
                </span>
              )}
            </div>

            {/* Connection Info */}
            {platform.connection ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Last synced</span>
                  <span>{formatDate(platform.connection.lastSync)}</span>
                </div>

                {platform.connection.lastError && (
                  <div className="p-2 bg-red-500/10 rounded text-xs text-red-400">
                    {platform.connection.lastError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => syncPlatform(platform.platform)}
                    disabled={syncing === platform.platform}
                    className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {syncing === platform.platform ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      'Sync Now'
                    )}
                  </button>
                  <button
                    onClick={() => disconnectPlatform(platform.platform)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {!platform.available ? (
                  <div className="text-sm text-white/40">
                    {platform.requiresApproval ? (
                      <span>Requires platform approval</span>
                    ) : (
                      <span>Coming soon</span>
                    )}
                  </div>
                ) : !platform.configured ? (
                  <div className="text-sm text-yellow-400/80">
                    API credentials not configured
                  </div>
                ) : null}

                <button
                  onClick={() => connectPlatform(platform.platform)}
                  disabled={
                    !platform.available ||
                    !platform.configured ||
                    connecting === platform.platform
                  }
                  className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {connecting === platform.platform ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      Connect
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Setup Guide */}
      <div className="mt-8 bg-white/5 rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">Setup Guide</h2>
        <div className="space-y-4 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
            <div>
              <p className="font-medium text-white">Configure API Credentials</p>
              <p className="mt-1">Add platform API keys to your environment variables. See <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">docs/FUTURE_TASKS.md</code> for details.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
            <div>
              <p className="font-medium text-white">Connect Your Accounts</p>
              <p className="mt-1">Click "Connect" to authorize access. You'll be redirected to the platform to grant permissions.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
            <div>
              <p className="font-medium text-white">Sync Data</p>
              <p className="mt-1">Click "Sync Now" to pull the latest analytics. Set up cron jobs for automatic syncing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-white/40 text-center">
        Platform Connections v1.0 • OAuth tokens are stored securely
      </div>
    </div>
  );
}
