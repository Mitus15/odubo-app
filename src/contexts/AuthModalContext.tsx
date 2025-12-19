'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type AuthView = 'signin' | 'signup' | 'account' | 'legal';
export type LegalTab = 'privacy' | 'terms' | 'shipping';

interface AuthModalState {
  isOpen: boolean;
  currentView: AuthView;
  legalTab: LegalTab | null;
}

interface AuthModalContextValue extends AuthModalState {
  // Open actions
  openSignIn: () => void;
  openSignUp: () => void;
  openAccount: () => void;
  openLegal: (tab?: LegalTab) => void;

  // Navigation within modal
  setView: (view: AuthView) => void;
  setLegalTab: (tab: LegalTab) => void;

  // Close
  close: () => void;
}

// ============================================================================
// Context
// ============================================================================

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AuthView>('signin');
  const [legalTab, setLegalTabState] = useState<LegalTab | null>(null);

  // ============================================================================
  // Actions
  // ============================================================================

  const openSignIn = useCallback(() => {
    setCurrentView('signin');
    setLegalTabState(null);
    setIsOpen(true);
  }, []);

  const openSignUp = useCallback(() => {
    setCurrentView('signup');
    setLegalTabState(null);
    setIsOpen(true);
  }, []);

  const openAccount = useCallback(() => {
    setCurrentView('account');
    setLegalTabState(null);
    setIsOpen(true);
  }, []);

  const openLegal = useCallback((tab: LegalTab = 'privacy') => {
    setCurrentView('legal');
    setLegalTabState(tab);
    setIsOpen(true);
  }, []);

  const setView = useCallback((view: AuthView) => {
    setCurrentView(view);
    if (view !== 'legal') {
      setLegalTabState(null);
    }
  }, []);

  const setLegalTab = useCallback((tab: LegalTab) => {
    setLegalTabState(tab);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ============================================================================
  // Provider
  // ============================================================================

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        currentView,
        legalTab,
        openSignIn,
        openSignUp,
        openAccount,
        openLegal,
        setView,
        setLegalTab,
        close,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
