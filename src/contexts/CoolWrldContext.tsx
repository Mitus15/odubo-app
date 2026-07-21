'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface CoolWrldUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  shopifyLinked: boolean;
  shopifyCustomerId?: string;
  coolPoints?: number;
  tier?: 'fan' | 'supporter' | 'loyal' | 'vip';
}

interface CoolWrldContextValue {
  user: CoolWrldUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
}

const CoolWrldContext = createContext<CoolWrldContextValue>({
  user: null,
  isLoading: true,
  isSignedIn: false,
});

export function CoolWrldProvider({ children }: { children: ReactNode }) {
  const [userData, setUserData] = useState<CoolWrldUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setIsLoading(false);
          return;
        }

        const data = await res.json() as { authenticated: boolean; user?: { id: string; email: string; firstName?: string; lastName?: string } };
        if (data.authenticated && data.user) {
          setUserData({
            id: data.user.id,
            email: data.user.email,
            firstName: data.user.firstName || undefined,
            lastName: data.user.lastName || undefined,
            shopifyLinked: false,
          });
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <CoolWrldContext.Provider
      value={{
        user: userData,
        isLoading,
        isSignedIn: !!userData,
      }}
    >
      {children}
    </CoolWrldContext.Provider>
  );
}

export function useCoolWrld() {
  const context = useContext(CoolWrldContext);
  if (!context) {
    throw new Error('useCoolWrld must be used within CoolWrldProvider');
  }
  return context;
}

export function useCoolPoints() {
  const { user } = useCoolWrld();
  return user?.coolPoints || 0;
}

export function useIsShopifyLinked() {
  const { user } = useCoolWrld();
  return user?.shopifyLinked || false;
}

export function useUserTier() {
  const { user } = useCoolWrld();
  return user?.tier || 'fan';
}
