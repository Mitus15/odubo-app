'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface QuickShopState {
  isOpen: boolean;
  productHandle: string | null;
}

interface QuickShopContextValue {
  isOpen: boolean;
  productHandle: string | null;
  openQuickShop: (handle: string) => void;
  closeQuickShop: () => void;
}

const QuickShopContext = createContext<QuickShopContextValue | null>(null);

export function QuickShopProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuickShopState>({
    isOpen: false,
    productHandle: null,
  });

  const openQuickShop = useCallback((handle: string) => {
    setState({ isOpen: true, productHandle: handle });
  }, []);

  const closeQuickShop = useCallback(() => {
    setState({ isOpen: false, productHandle: null });
  }, []);

  return (
    <QuickShopContext.Provider
      value={{
        isOpen: state.isOpen,
        productHandle: state.productHandle,
        openQuickShop,
        closeQuickShop,
      }}
    >
      {children}
    </QuickShopContext.Provider>
  );
}

export function useQuickShop() {
  const context = useContext(QuickShopContext);
  if (!context) {
    throw new Error('useQuickShop must be used within a QuickShopProvider');
  }
  return context;
}
