'use client';

import { useState, useEffect, useRef } from 'react';
import ThreeScene, { MODELS } from './ThreeScene';
import type { ModelEntry } from './ThreeScene';

/* ─── Poster assets (secondary gallery) ───────────────────────────────── */

interface PosterAsset {
  id: string;
  name: string;
  src: string;
  tools: string[];
}

const posterAssets: PosterAsset[] = [
  {
    id: 'saint-poster',
    name: 'Saint — Poster',
    src: '/Designs/saint.png',
    tools: ['AI Generation', 'Manual Refinement', 'Brand Alignment'],
  },
  {
    id: 'swan-poster',
    name: 'Swan — Poster',
    src: '/Designs/swan.png',
    tools: ['AI Generation', 'Manual Refinement', 'Brand Alignment'],
  },
  {
    id: 'brand-logo',
    name: 'Odubo Logo',
    src: '/odubo_logo_emboss.webp',
    tools: ['AI Generation', 'Vector Refinement', 'Brand System'],
  },
  {
    id: 'brand-emboss',
    name: 'Odubo Emboss',
    src: '/odubo_logo_emboss.png',
    tools: ['AI Generation', 'Vector Refinement', 'Brand System'],
  },
];

/* ─── Model Info Panel ────────────────────────────────────────────────── */

function ModelInfo({ model }: { model: ModelEntry }) {
  return (
    <div className="about-card h-full flex flex-col">
      <h3 className="font-semibold text-[#1a1a1a] text-lg mb-1 font-['Baskerville']">
        {model.name}
      </h3>
      <div className="mb-3">
        <span className="about-label text-[0.625rem] mb-1 block">Type</span>
        <span className="about-skill-tag text-[0.6875rem]">
          {model.type}
        </span>
      </div>
      <p className="about-body text-sm mb-4 leading-relaxed">
        {model.description}
      </p>
      <div className="mt-auto">
        <span className="about-label text-[0.625rem] mb-1.5 block">Skills Demonstrated</span>
        <div className="flex flex-wrap gap-1.5">
          {model.skills.map((skill) => (
            <span key={skill} className="about-skill-tag text-[0.6875rem]">
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */

export default function ModelViewer() {
  const [activeModel, setActiveModel] = useState<ModelEntry>(MODELS[0]);
  const [activePoster, setActivePoster] = useState<PosterAsset>(posterAssets[0]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100');
          entry.target.classList.remove('opacity-0');
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section className="about-section" ref={sectionRef}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 opacity-0 transition-opacity duration-700 ease-out">
          {/* ── 3D Showcase ── */}
          <div className="about-eyebrow">3D Portfolio</div>
          <h2 className="about-heading mb-3">Characters, Worlds & Prototypes</h2>
          <p className="about-body about-body-large max-w-2xl mb-8">
            3D assets created through AI-assisted generation with manual refinement in Blender.
            Click and drag to explore each model. Auto-rotates — interact to take control.
          </p>

          {/* Model selector tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setActiveModel(model)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  activeModel.id === model.id
                    ? 'bg-[#843c2d] text-white'
                    : 'bg-white text-[#5c5550] border border-[#e5ddd6] hover:border-[#843c2d]/30'
                }`}
              >
                {model.name}
              </button>
            ))}
          </div>

          {/* 3D Viewer + Info Panel */}
          <div className="grid md:grid-cols-5 gap-6 mb-10">
            <div className="md:col-span-3">
              <ThreeScene modelPath={activeModel.path} />
            </div>
            <div className="md:col-span-2">
              <ModelInfo model={activeModel} />
            </div>
          </div>

          {/* Workflow note */}
          <div className="mb-12 about-card about-card-accent">
            <p className="about-body text-sm">
              <strong className="text-[#1a1a1a]">Workflow:</strong> 3D models are generated using
              AI-assisted tools (MCP servers, Claude Code) and then refined manually in Blender for
              proportions, topology, and brand alignment. This approach combines rapid AI generation
              with manual craftsmanship — producing professional 3D assets without traditional
              3D art pipelines.
            </p>
          </div>

          {/* ── Divider ── */}
          <hr className="about-divider mb-10" />

          {/* ── Posters & Branding (secondary gallery) ── */}
          <div className="about-eyebrow">Design & Visual Assets</div>
          <h2 className="about-heading mb-3">Posters, Branding & Prints</h2>
          <p className="about-body about-body-large max-w-2xl mb-8">
            Visual assets created using AI-assisted generation with manual refinement —
            spanning poster designs, brand identity, and print materials. Click any
            image to view full size.
          </p>

          {/* Poster selector tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {posterAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setActivePoster(asset)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  activePoster.id === asset.id
                    ? 'bg-[#843c2d] text-white'
                    : 'bg-white text-[#5c5550] border border-[#e5ddd6] hover:border-[#843c2d]/30'
                }`}
              >
                {asset.name}
              </button>
            ))}
          </div>

          {/* Poster viewer + info */}
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3">
              <div
                className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-[#ede6de] cursor-pointer group"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={activePoster.src}
                  alt={activePoster.name}
                  className="w-full h-full object-contain p-4"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
                    Click to view full size
                  </span>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="about-card h-full">
                <h3 className="font-semibold text-[#1a1a1a] text-lg mb-2 font-['Baskerville']">
                  {activePoster.name}
                </h3>
                <div className="mb-4">
                  <span className="about-label text-[0.625rem] mb-2 block">Created With</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activePoster.tools.map((tool) => (
                      <span key={tool} className="about-skill-tag text-[0.6875rem]">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full poster gallery grid */}
          <div className="mt-10">
            <span className="about-label text-[0.625rem] mb-3 block">All Assets</span>
            <div className="about-design-grid">
              {posterAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setActivePoster(asset)}
                  className={`about-design-item ${
                    activePoster.id === asset.id ? 'ring-2 ring-[#843c2d]' : ''
                  }`}
                >
                  <img src={asset.src} alt={asset.name} loading="lazy" />
                  <div className="about-design-item-label">{asset.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="about-lightbox" onClick={() => setLightboxOpen(false)}>
          <img src={activePoster.src} alt={activePoster.name} />
        </div>
      )}
    </>
  );
}
