"use client";

import { createContext, useContext, useState, useEffect, ReactNode, CSSProperties } from "react";

export type ArkDensity = "sm" | "md" | "lg";

interface DensityContextValue {
  density: ArkDensity;
  setDensity: (d: ArkDensity) => void;
}

const STORAGE_KEY = "ark:density";

const DensityContext = createContext<DensityContextValue>({
  density: "md",
  setDensity: () => {},
});

// CSS custom properties for each density level
// These cascade to ALL children automatically — no prop drilling needed
const densityVars: Record<ArkDensity, CSSProperties> = {
  sm: {
    "--ark-text-xs": "9px",
    "--ark-text-sm": "10px",
    "--ark-text-base": "12px",
    "--ark-text-lg": "14px",
    "--ark-text-xl": "16px",
    "--ark-text-2xl": "20px",
    "--ark-text-3xl": "24px",
    "--ark-gap": "4px",
    "--ark-gap-sm": "2px",
    "--ark-gap-lg": "8px",
    "--ark-pad": "10px",
    "--ark-pad-sm": "6px",
    "--ark-pad-lg": "12px",
    "--ark-pad-xl": "16px",
    "--ark-card-pad": "10px",
    "--ark-row-py": "8px",
    "--ark-row-px": "12px",
    "--ark-radius": "8px",
    "--ark-icon": "16px",
    "--ark-icon-lg": "24px",
    "--ark-checkbox": "16px",
    "--ark-input-py": "6px",
    "--ark-input-px": "8px",
    "--ark-header-py": "12px",
  } as CSSProperties,
  md: {
    "--ark-text-xs": "10px",
    "--ark-text-sm": "12px",
    "--ark-text-base": "14px",
    "--ark-text-lg": "16px",
    "--ark-text-xl": "18px",
    "--ark-text-2xl": "24px",
    "--ark-text-3xl": "30px",
    "--ark-gap": "12px",
    "--ark-gap-sm": "6px",
    "--ark-gap-lg": "16px",
    "--ark-pad": "20px",
    "--ark-pad-sm": "12px",
    "--ark-pad-lg": "24px",
    "--ark-pad-xl": "32px",
    "--ark-card-pad": "16px",
    "--ark-row-py": "14px",
    "--ark-row-px": "16px",
    "--ark-radius": "12px",
    "--ark-icon": "20px",
    "--ark-icon-lg": "32px",
    "--ark-checkbox": "20px",
    "--ark-input-py": "10px",
    "--ark-input-px": "12px",
    "--ark-header-py": "20px",
  } as CSSProperties,
  lg: {
    "--ark-text-xs": "12px",
    "--ark-text-sm": "14px",
    "--ark-text-base": "16px",
    "--ark-text-lg": "18px",
    "--ark-text-xl": "22px",
    "--ark-text-2xl": "30px",
    "--ark-text-3xl": "36px",
    "--ark-gap": "16px",
    "--ark-gap-sm": "8px",
    "--ark-gap-lg": "24px",
    "--ark-pad": "24px",
    "--ark-pad-sm": "16px",
    "--ark-pad-lg": "32px",
    "--ark-pad-xl": "40px",
    "--ark-card-pad": "24px",
    "--ark-row-py": "20px",
    "--ark-row-px": "24px",
    "--ark-radius": "16px",
    "--ark-icon": "24px",
    "--ark-icon-lg": "40px",
    "--ark-checkbox": "24px",
    "--ark-input-py": "12px",
    "--ark-input-px": "16px",
    "--ark-header-py": "24px",
  } as CSSProperties,
};

export function ArkDensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<ArkDensity>("md");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ArkDensity | null;
    if (stored && ["sm", "md", "lg"].includes(stored)) {
      setDensityState(stored);
    }
  }, []);

  const setDensity = (d: ArkDensity) => {
    setDensityState(d);
    localStorage.setItem(STORAGE_KEY, d);
  };

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      <div className="ark-density-root" style={densityVars[density]}>
        {children}
      </div>
    </DensityContext.Provider>
  );
}

export function useArkDensity() {
  return useContext(DensityContext);
}

// Toggle component for use in top bars
export function DensityToggle() {
  const { density, setDensity } = useArkDensity();
  return (
    <div className="flex bg-[#1a1816] border border-[#302927] rounded-lg overflow-hidden">
      {(["sm", "md", "lg"] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDensity(d)}
          className={`px-2.5 py-1 text-[10px] font-medium uppercase transition-colors ${
            density === d ? "bg-[#843c2d] text-[#ede8df]" : "text-[#726d6c] hover:text-[#ede8df]"
          }`}
          title={d === "sm" ? "Compact" : d === "md" ? "Medium" : "Spacious"}
        >
          {d === "sm" ? "S" : d === "md" ? "M" : "L"}
        </button>
      ))}
    </div>
  );
}
