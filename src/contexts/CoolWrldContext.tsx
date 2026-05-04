'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';

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
  const { user, isLoaded } = useUser();

  const [userData, setUserData] = useState<CoolWrldUser | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      const metadata = user.publicMetadata as Record<string, any> || {};
      
      setUserData({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        imageUrl: user.imageUrl || undefined,
        shopifyLinked: !!metadata.shopify_customer_id,
        shopifyCustomerId: metadata.shopify_customer_id,
        coolPoints: metadata.cool_points_balance,
        tier: metadata.tier || 'fan',
      });
    } else if (isLoaded && !user) {
      setUserData(null);
    }
  }, [isLoaded, user]);

  return (
    <CoolWrldContext.Provider
      value={{
        user: userData,
        isLoading: !isLoaded,
        isSignedIn: !!user,
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
