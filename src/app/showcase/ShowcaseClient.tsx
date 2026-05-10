'use client';

import { useState, useEffect } from 'react';
import ThreeScene, { MODELS } from '@/app/about/components/ThreeScene';
import type { ModelEntry } from '@/app/about/components/ThreeScene';

/* ─── Info Modal ──────────────────────────────────────────────────────── */

function InfoModal({ model, onClose }: { model: ModelEntry; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-[#9c9490] hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Type badge */}
        <span className="inline-block px-2.5 py-1 rounded-full text-[0.6875rem] font-medium bg-white/10 text-white/80 border border-white/10 mb-4">
          {model.type}
        </span>

        <h2 className="font-['Baskerville'] text-2xl font-semibold text-white mb-3">
          {model.name}
        </h2>

        <p className="text-sm text-[#b5ada8] leading-relaxed mb-6">
          {model.description}
        </p>

        {/* Skills */}
        <div>
          <span className="text-[0.5rem] font-semibold tracking-[0.2em] uppercase text-[#9c9490] block mb-2">
            Skills Demonstrated
          </span>
          <div className="flex flex-wrap gap-1.5">
            {model.skills.map((skill) => (
              <span
                key={skill}
                className="inline-block px-2 py-1 rounded text-[0.625rem] font-medium bg-[#843c2d]/20 text-[#c97a63] border border-[#843c2d]/20"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Divider */}
        <hr className="border-white/10 my-6" />

        {/* Workflow note */}
        <div className="space-y-2">
          <span className="text-[0.5rem] font-semibold tracking-[0.2em] uppercase text-[#9c9490] block">
            Workflow
          </span>
          <p className="text-xs text-[#7a726d] leading-relaxed">
            AI-assisted generation → manual refinement in Blender → web-ready GLB. 
            This approach combines rapid iteration with artisanal polish.
          </p>
        </div>

        {/* Divider */}
        <hr className="border-white/10 my-6" />

        <a
          href="/about"
          className="block w-full text-center px-4 py-2.5 rounded-lg text-xs font-semibold tracking-[0.1em] uppercase bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors"
        >
          View Full Case Study
        </a>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */

export default function ShowcaseClient() {
  const [activeModel, setActiveModel] = useState<ModelEntry>(MODELS[0]);
  const [showInfo, setShowInfo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-dvh w-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/about"
            className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-[#9c9490] hover:text-white transition-colors"
          >
            Odubo Studio
          </a>
          <span className="text-[#3a3a3a] text-xs hidden sm:inline">/</span>
          <span className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-white hidden sm:inline">
            3D Portfolio
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInfo(true)}
            className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#9c9490] hover:text-white transition-colors"
          >
            Info
          </button>
          <a
            href="/about"
            className="text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-[#9c9490] hover:text-white transition-colors"
          >
            Case Study →
          </a>
        </div>
      </header>

      {/* ── Model selector tabs ── */}
      <div className="px-4 sm:px-6 pb-3 z-20 shrink-0 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModel(model)}
              className={`shrink-0 px-3 sm:px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                activeModel.id === model.id
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/5 text-[#9c9490] border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Full-screen 3D Viewer ── */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0">
        <div className="w-full h-full max-h-[65vh] lg:max-h-full">
          {mounted && <ThreeScene modelPath={activeModel.path} />}
        </div>
      </div>

      {/* ── Bottom hint ── */}
      <div className="px-4 sm:px-6 py-2 z-20 shrink-0 text-center">
        <p className="text-[0.5rem] font-medium tracking-[0.15em] uppercase text-[#5a524d]">
          Drag to explore · Scroll to zoom · Auto-rotates
        </p>
      </div>

      {/* ── Info Modal ── */}
      {showInfo && <InfoModal model={activeModel} onClose={() => setShowInfo(false)} />}
    </div>
  );
}
