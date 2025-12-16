"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  username?: string;
  role?: string;
  is_admin?: number | boolean;
};

type UserContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({ user: null, loading: true, refresh: async () => {} });

export function useUser() {
  return useContext(UserContext);
}

export default function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedRef = React.useRef<number>(0);
  const inFlightRef = React.useRef<Promise<void> | null>(null);

  const fetchUser = async () => {
    const now = Date.now();
    try {
      // Use sessionStorage cache to reduce jitter and requests
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem('me.cache') : null;
      const cachedTsStr = typeof window !== 'undefined' ? sessionStorage.getItem('me.cache.ts') : null;
      const cachedTs = cachedTsStr ? parseInt(cachedTsStr, 10) : 0;
      if (cached && cachedTs && now - cachedTs < 120000) { // 2 minutes
        try {
          const parsed = JSON.parse(cached) as { user?: User };
          setUser(parsed?.user || null);
          lastFetchedRef.current = cachedTs;
          return;
        } catch {}
      }

      // Debounce concurrent calls
      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }
      const p = (async () => {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json() as { user?: User };
          setUser(data?.user || null);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('me.cache', JSON.stringify(data));
              sessionStorage.setItem('me.cache.ts', String(now));
            } catch {}
          }
          lastFetchedRef.current = now;
        }
      })();
      inFlightRef.current = p;
      await p;
      inFlightRef.current = null;
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      setLoading(true);
      await fetchUser();
      if (!cancelled) setLoading(false);
    };
    go();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ user, loading, refresh: fetchUser }), [user, loading]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
