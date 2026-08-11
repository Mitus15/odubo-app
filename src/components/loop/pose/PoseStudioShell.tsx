"use client";

import { useState } from "react";
import PoseStudio from "./PoseStudio";
import PoseVideoStudio from "./PoseVideoStudio";
import PoseGallery from "./PoseGallery";
import WallGallery from "@/components/loop/wall/WallGallery";

type Mode = "photo" | "video" | "gallery" | "wall";

/**
 * Pose Studio shell — owns the header + mode toggle and swaps the active mode.
 * Saves in Photo/Video bump `refreshKey` so the on-device gallery reloads.
 * `wallEnabled` (the gated Portal) adds The Wall — the room's shared gallery —
 * and renames the on-device tab to "Mine" to make device vs. room obvious.
 */
export function PoseStudioShell({ wallEnabled = false }: { wallEnabled?: boolean }) {
  const [mode, setMode] = useState<Mode>("photo");
  const [refreshKey, setRefreshKey] = useState(0);
  const onSaved = () => setRefreshKey((k) => k + 1);

  const tabs: { id: Mode; label: string }[] = [
    { id: "photo", label: "Photo" },
    { id: "video", label: "Video" },
    { id: "gallery", label: wallEnabled ? "Mine" : "Gallery" },
    ...(wallEnabled ? [{ id: "wall" as Mode, label: "The Wall" }] : []),
  ];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center gap-4 bg-ink px-5 py-6 text-bone">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-sand">Pose Studio</h1>
        <p className="text-sm opacity-70">Strike a pose — we&apos;ll Loop Soul it.</p>
      </header>

      <div className="flex w-full rounded-full border border-sand/25 bg-ink-soft p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              mode === t.id ? "bg-sand text-ink" : "text-bone/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Keep Photo & Video mounted only when active (each owns the camera). */}
      {mode === "photo" && <PoseStudio onSaved={onSaved} wallEnabled={wallEnabled} />}
      {mode === "video" && <PoseVideoStudio onSaved={onSaved} />}
      {mode === "gallery" && <PoseGallery refreshKey={refreshKey} wallEnabled={wallEnabled} />}
      {mode === "wall" && <WallGallery canPost />}
    </main>
  );
}

export default PoseStudioShell;
