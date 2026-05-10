'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Center } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Model definitions ──────────────────────────────────────────────── */

export interface ModelEntry {
  id: string;
  name: string;
  path: string;
  type: string;
  skills: string[];
  description: string;
}

export const MODELS: ModelEntry[] = [
  {
    id: 'avatar-male',
    name: 'Male Avatar',
    path: '/models/avatar-male.glb',
    type: 'Character Design',
    skills: ['3D Modeling', 'Character Design', 'Game Asset Creation'],
    description: 'A playable character concept for a runner-style game. Designed as a stylized avatar that players could control through the game world. Part of an ongoing experiment to build immersive 3D experiences from scratch.',
  },
  {
    id: 'avatar-female',
    name: 'Female Avatar',
    path: '/models/avatar-female.glb',
    type: 'Character Design',
    skills: ['3D Modeling', 'Character Design', 'Game Asset Creation'],
    description: 'The counterpart character for the game, expanding the roster of playable avatars. Designed to maintain visual consistency while offering variety — showing the ability to iterate on a character pipeline.',
  },
  {
    id: 'city',
    name: 'Game World — City Environment',
    path: '/models/city/city_compressed.glb',
    type: 'Game Environment',
    skills: ['3D World Building', 'Environmental Design', 'Game Level Prototyping'],
    description: 'The game environment — a stylized city built as the setting for a runner-style game. Still a work in progress, this scene represents an early attempt at creating an immersive 3D world to explore the possibilities of browser-based game environments.',
  },
  {
    id: 'stickman',
    name: 'Stickman (Rigged Prototype)',
    path: '/models/city/stickman.glb',
    type: 'Rigging & Animation Prep',
    skills: ['Rigging', 'Joint Structure', 'Animation Pipeline'],
    description: 'A rigged stick figure prototype with visible joints — unlike the other characters, this one has a full skeleton structure ready for animation. Built to experiment with character rigging and understand how joint hierarchies work before applying them to the main avatars.',
  },
];

/* ─── 3D Model Component ─────────────────────────────────────────────── */

function Model({ path, onLoaded }: { path: string; onLoaded: () => void }) {
  const { scene } = useGLTF(path);
  const cloned = scene.clone(true);

  useEffect(() => {
    const timer = setTimeout(() => onLoaded(), 200);
    return () => clearTimeout(timer);
  }, [onLoaded]);

  // Ensure all meshes cast/receive shadows and have visible materials
  cloned.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      // If material is very dark, lighten it so it's visible against dark bg
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            // Boost emissive slightly so dark materials are visible
            if (!mat.emissive || mat.emissive.getHex() === 0x000000) {
              mat.emissive = new THREE.Color(0x222222);
              mat.emissiveIntensity = 0.15;
            }
          }
        });
      }
    }
  });

  // Auto-scale based on bounding box
  const box = new THREE.Box3().setFromObject(cloned);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 5 ? 5 / maxDim : 1;

  return (
    <Center scale={scale}>
      <primitive object={cloned} />
    </Center>
  );
}

/* ─── Loading Spinner ─────────────────────────────────────────────────── */

function Loader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] rounded-lg z-10">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#9c9490] font-medium">Loading 3D model…</span>
      </div>
    </div>
  );
}

/* ─── Error Fallback ──────────────────────────────────────────────────── */

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] rounded-lg z-10">
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <svg className="w-10 h-10 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-[#9c9490]">Couldn't load this model.</p>
        <button
          onClick={onRetry}
          className="text-xs text-[#843c2d] hover:text-[#a85a48] font-medium underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ─── Scene ───────────────────────────────────────────────────────────── */

function Scene({ path, onModelLoaded }: { path: string; onModelLoaded: () => void }) {
  return (
    <>
      {/* Brighter ambient + directional for dark materials */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={2} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.8} />
      <directionalLight position={[0, -5, 0]} intensity={0.3} />
      <spotLight position={[0, 10, 0]} intensity={0.6} angle={0.5} penumbra={1} />
      <Environment preset="city" />
      <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={10} blur={2.5} far={4} />
      <Suspense fallback={null}>
        <Model path={path} onLoaded={onModelLoaded} />
      </Suspense>
      <OrbitControls
        autoRotate
        autoRotateSpeed={2.5}
        enablePan={false}
        minDistance={2}
        maxDistance={15}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
      />
    </>
  );
}

/* ─── Main ThreeScene Component ───────────────────────────────────────── */

interface ThreeSceneProps {
  modelPath: string;
  className?: string;
}

export default function ThreeScene({ modelPath, className = '' }: ThreeSceneProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [key, setKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setKey((k) => k + 1);
  };

  const handleModelLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setKey((k) => k + 1);
  }, [modelPath]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[300px] rounded-lg overflow-hidden bg-[#0a0a0a] ${className}`}
    >
      {isLoading && <Loader />}
      {hasError ? (
        <ErrorFallback onRetry={handleRetry} />
      ) : (
        <Canvas
          key={key}
          shadows
          camera={{ position: [4, 3, 6], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a0a0a');
          }}
          onError={(e) => {
            console.error('[ThreeScene] Canvas error:', e);
            setHasError(true);
            setIsLoading(false);
          }}
          style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}
        >
          <Scene path={modelPath} onModelLoaded={handleModelLoaded} />
        </Canvas>
      )}
    </div>
  );
}
