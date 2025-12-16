"use client";
import React from "react";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 m-4 rounded-xl border border-red-600/40 bg-red-900/20 text-red-200">
      <p className="text-sm font-semibold mb-2">Something went wrong on Social Ops.</p>
      <p className="text-xs mb-3">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-3 py-2 rounded-lg bg-[#302927] hover:bg-[#502d26]/80 text-[11px] text-[#ede8df] border border-[#502d26]/40"
      >
        Retry rendering
      </button>
    </div>
  );
}
