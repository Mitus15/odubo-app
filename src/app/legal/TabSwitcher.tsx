"use client";

const tabs = [
  { key: "privacy", label: "Privacy" },
  { key: "terms", label: "Terms" },
  { key: "shipping", label: "Shipping" },
];

interface TabSwitcherProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export default function TabSwitcher({ onTabChange, activeTab }: TabSwitcherProps) {
  return (
    <div className="flex justify-center gap-1 p-1 rounded-2xl bg-[#1a1615]/60 border border-[#502d26]/20 backdrop-blur-sm max-w-md mx-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
            activeTab === tab.key 
              ? "bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] shadow-lg" 
              : "text-[#b2a491] hover:text-[#ede8df] hover:bg-white/5"
          }`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
