"use client";
import { useState } from "react";

const tabs = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms of Service" },
  { key: "shipping", label: "Shipping & Returns" },
];

interface TabSwitcherProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export default function TabSwitcher({ onTabChange, activeTab }: TabSwitcherProps) {
  return (
    <div className="flex gap-2 mb-6 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`py-2 px-4 border-b-2 text-sm font-medium transition-colors duration-150 ${
            activeTab === tab.key 
              ? "border-blue-600 text-blue-700" 
              : "border-transparent text-gray-500 hover:text-blue-600"
          }`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
