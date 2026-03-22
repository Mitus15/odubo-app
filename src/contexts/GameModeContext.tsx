'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface GameModeContextValue {
  isGameActive: boolean;
  openGame: () => void;
  closeGame: () => void;
}

const GameModeContext = createContext<GameModeContextValue>({
  isGameActive: false,
  openGame: () => {},
  closeGame: () => {},
});

export function GameModeProvider({ children }: { children: ReactNode }) {
  const [isGameActive, setIsGameActive] = useState(false);

  const openGame = useCallback(() => setIsGameActive(true), []);
  const closeGame = useCallback(() => setIsGameActive(false), []);

  return (
    <GameModeContext.Provider value={{ isGameActive, openGame, closeGame }}>
      {children}
    </GameModeContext.Provider>
  );
}

export function useGameMode() {
  return useContext(GameModeContext);
}
