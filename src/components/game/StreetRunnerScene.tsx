'use client';

// ============================================================================
// StreetRunnerScene — React Three Fiber 3D scene for the street runner game
//
// Loads the actual Blender-built cityscape (city_compressed.glb) and the
// rigged stickman (stickman.glb). Respects Blender materials and lighting.
// ============================================================================

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { StreetRunnerEngine, LANE_X } from './StreetRunnerEngine';
import type { StreetRunnerState, RunnerLane, RunnerObstacle, RunnerOrb } from '@/types/game';

// ============================================================================
// Constants
// ============================================================================

const CHUNK_LENGTH = 120; // Full Blender scene is 120m (Y=0 to Y=120)
const NUM_CHUNKS = 3;

const COLORS = {
  fog: '#0a0810',
  cream: '#ede8df',
};

// ============================================================================
// Scene handle
// ============================================================================

export interface StreetRunnerSceneHandle {
  start: () => Promise<void>;
  stop: () => void;
}

// ============================================================================
// Main Scene Component
// ============================================================================

const StreetRunnerScene = forwardRef<StreetRunnerSceneHandle, {
  onStateChange?: (state: StreetRunnerState) => void;
  onGameOver?: (score: number, totalCatches: number, duration: number) => void;
  avatarGender?: 'male' | 'female';
}>(function StreetRunnerScene({ onStateChange, onGameOver, avatarGender = 'male' }, ref) {
  const engineRef = useRef<StreetRunnerEngine | null>(null);
  const [gameState, setGameState] = useState<StreetRunnerState | null>(null);

  useEffect(() => {
    const engine = new StreetRunnerEngine();
    engine.onStateChange = (state) => {
      setGameState(state);
      onStateChange?.(state);
    };
    engine.onGameOver = (score, catches, duration) => {
      onGameOver?.(score, catches, duration);
    };
    engineRef.current = engine;
    return () => { engine.stop(); };
  }, [onStateChange, onGameOver]);

  useImperativeHandle(ref, () => ({
    start: async () => { await engineRef.current?.start(); },
    stop: () => { engineRef.current?.stop(); },
  }));

  // --- Keyboard input (left/right swapped to fix axis inversion) ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      switch (e.key) {
        case 'ArrowLeft': case 'a': eng.moveRight(); break;  // Swapped
        case 'ArrowRight': case 'd': eng.moveLeft(); break;   // Swapped
        case 'ArrowUp': case 'w': case ' ': e.preventDefault(); eng.jump(); break;
        case 'ArrowDown': case 's': eng.slide(); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- Touch swipe ---
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    const eng = engineRef.current;
    if (!eng) return;
    const minSwipe = 30;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
      // Swapped left/right to fix axis inversion
      if (dx > 0) eng.moveLeft(); else eng.moveRight();
    } else if (Math.abs(dy) > minSwipe) {
      if (dy < 0) eng.jump(); else eng.slide();
    }
  }, []);

  return (
    <div className="w-full h-full touch-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Canvas
        shadows
        camera={{ position: [0, 5.5, 8], fov: 59, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8,
        }}
      >
        <color attach="background" args={[COLORS.fog]} />
        <fog attach="fog" args={[COLORS.fog, 40, 150]} />

        {/* Moonlight — matches Blender atmosphere_MoonLight */}
        <directionalLight
          position={[60, 80, -100]}
          color={new THREE.Color(0.7, 0.75, 1.0)}
          intensity={0.3}
        />

        {/* Ambient fill — just enough to see silhouettes in darkness */}
        <ambientLight intensity={0.15} color="#203050" />

        <Suspense fallback={null}>
          <GameWorld engineRef={engineRef} state={gameState} avatarGender={avatarGender} />
        </Suspense>
      </Canvas>
    </div>
  );
});

export default StreetRunnerScene;

// ============================================================================
// GameWorld — inside Canvas
// ============================================================================

function GameWorld({
  engineRef,
  state,
  avatarGender = 'male',
}: {
  engineRef: React.RefObject<StreetRunnerEngine | null>;
  state: StreetRunnerState | null;
  avatarGender?: 'male' | 'female';
}) {
  useFrame((_, delta) => {
    engineRef.current?.tick(delta);
  });

  const playerY = state?.playerY ?? 0;
  const lightRadius = state?.lightRadius ?? 15;

  return (
    <>
      {/* Tiling city from Blender GLB */}
      <CityModel playerY={playerY} lightRadius={lightRadius} />

      {/* Player — Recoolman / Recoolwoman */}
      <PlayerModel state={state} avatarGender={avatarGender} />

      {/* Dynamic obstacles from engine */}
      {state?.obstacles.map(obs => (
        <ObstacleMesh key={obs.id} obstacle={obs} playerY={playerY} />
      ))}

      {/* Dynamic orbs from engine */}
      {state?.orbs.map(orb => (
        <OrbMesh key={orb.id} orb={orb} playerY={playerY} />
      ))}

      {/* Chase camera */}
      <ChaseCamera playerY={playerY} playerLane={state?.playerLane ?? 0} />
    </>
  );
}

// ============================================================================
// CityModel — loads the Blender GLB and tiles it, preserving materials
// ============================================================================

function CityModel({ playerY, lightRadius }: { playerY: number; lightRadius: number }) {
  const gltf = useGLTF('/models/city/city_compressed.glb', '/draco/');

  // Clone scene for tiling
  const scenes = useMemo(() => {
    return Array.from({ length: NUM_CHUNKS }, () => gltf.scene.clone(true));
  }, [gltf.scene]);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    for (let i = 0; i < scenes.length; i++) {
      const group = groupRefs.current[i];
      if (!group) continue;

      // Each copy covers CHUNK_LENGTH meters
      const baseOffset = i * CHUNK_LENGTH;
      let copyStart = baseOffset;

      // Wrap so there's always city around the player
      const totalSpan = CHUNK_LENGTH * NUM_CHUNKS;
      while (copyStart + CHUNK_LENGTH < playerY - 20) {
        copyStart += totalSpan;
      }
      while (copyStart > playerY + CHUNK_LENGTH + 20) {
        copyStart -= totalSpan;
      }

      // Blender Y=forward maps to Three.js -Z
      // The scene is rotated -90° on X, so Blender Y becomes Three.js Z
      // Position offset along Z axis
      group.position.set(0, 0, -(copyStart - playerY));
    }
  });

  return (
    <>
      {scenes.map((scene, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          // Blender Z-up → Three.js Y-up
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <primitive object={scene} />
        </group>
      ))}

      {/* Recoolman's light — follows player, matches Blender light_RecoolmanPoint */}
      <pointLight
        position={[0, 3, 0]}
        color={new THREE.Color(1.0, 0.9, 0.7)}
        intensity={lightRadius * 20}
        distance={lightRadius * 2}
        decay={2}
        castShadow
      />
    </>
  );
}

useGLTF.preload('/models/city/city_compressed.glb', '/draco/');
useGLTF.preload('/models/avatar-male.glb');
useGLTF.preload('/models/avatar-female.glb');

// ============================================================================
// PlayerModel — loads Recoolman / Recoolwoman avatar
// ============================================================================

function PlayerModel({ state, avatarGender = 'male' }: { state: StreetRunnerState | null; avatarGender?: 'male' | 'female' }) {
  const modelPath = `/models/avatar-${avatarGender}.glb`;
  const gltf = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const targetX = useRef(0);

  // Clone the scene so we own this instance
  const playerScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useFrame((_, delta) => {
    if (!groupRef.current || !state) return;
    const laneX = LANE_X[state.targetLane];
    targetX.current += (laneX - targetX.current) * Math.min(1, delta * 12);
    groupRef.current.position.x = targetX.current;
    // Jump height + subtle run bob
    groupRef.current.position.y = state.playerJumpZ + Math.sin(state.playerY * 3) * 0.05;

    // Simple run animation: tilt forward slightly when moving fast
    const tilt = Math.min(0.15, state.speed * 0.003);
    groupRef.current.rotation.x = state.isSliding ? -0.8 : -tilt;

    // Hit flash — make all materials flash red briefly
    playerScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (state.hitFlash) {
          mat.emissive = new THREE.Color(0xff0000);
          mat.emissiveIntensity = 2;
        } else {
          mat.emissive = new THREE.Color(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });
  });

  if (!state) return null;

  return (
    <group ref={groupRef}>
      <primitive object={playerScene} scale={1} />

      {/* Player glow aura */}
      <pointLight
        position={[0, 1.5, 0]}
        color="#ffe0b0"
        intensity={state.lightRadius * 3}
        distance={state.lightRadius}
        decay={2}
      />

      {/* Clothing overlays (simple color indicators on the model) */}
      <ClothingOverlays clothing={state.clothing} />
    </group>
  );
}

function ClothingOverlays({ clothing }: { clothing: StreetRunnerState['clothing'] }) {
  return (
    <>
      {clothing.top && (
        <mesh position={[0, 1.0, 0]}>
          <capsuleGeometry args={[0.14, 0.45, 4, 8]} />
          <meshStandardMaterial color={clothing.top.color} transparent opacity={0.6} />
        </mesh>
      )}
      {clothing.bottom && (
        <>
          <mesh position={[-0.08, 0.25, 0]}>
            <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
            <meshStandardMaterial color={clothing.bottom.color} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.08, 0.25, 0]}>
            <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
            <meshStandardMaterial color={clothing.bottom.color} transparent opacity={0.6} />
          </mesh>
        </>
      )}
      {clothing.layer && (
        <mesh position={[0, 1.05, 0]}>
          <capsuleGeometry args={[0.16, 0.4, 4, 8]} />
          <meshStandardMaterial color={clothing.layer.color} transparent opacity={0.4} />
        </mesh>
      )}
    </>
  );
}

// ============================================================================
// Obstacles — engine-spawned, rendered as simple geometry
// (These supplement the static Blender obstacles in the city GLB)
// ============================================================================

function ObstacleMesh({ obstacle, playerY }: { obstacle: RunnerObstacle; playerY: number }) {
  const relativeZ = obstacle.y - playerY;
  if (relativeZ < -5 || relativeZ > 80) return null;
  const x = LANE_X[obstacle.lane];

  switch (obstacle.type) {
    case 'barrier':
      return (
        <mesh position={[x, 0.45, relativeZ]}>
          <boxGeometry args={[2.5, 0.9, 0.5]} />
          <meshStandardMaterial color="#2a2018" roughness={0.9} />
        </mesh>
      );
    case 'car':
      return (
        <group position={[x, 0, relativeZ]} rotation={[0, obstacle.id % 2 ? 0.4 : -0.4, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.8, 1, 3.5]} />
            <meshStandardMaterial color="#0a0808" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.1, 0.2]}>
            <boxGeometry args={[1.5, 0.6, 2]} />
            <meshStandardMaterial color="#0a0808" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'shadow_pool':
      return (
        <mesh position={[x, 0.03, relativeZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 16]} />
          <meshStandardMaterial color="#2a1525" emissive="#2a1525" emissiveIntensity={2} transparent opacity={0.8} />
        </mesh>
      );
    case 'shadow_pillar':
      return (
        <group position={[x, 0, relativeZ]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 4]} />
            <meshStandardMaterial color="#0a0510" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.7, 0.05, 8, 24]} />
            <meshStandardMaterial color="#6600ff" emissive="#6600ff" emissiveIntensity={4} />
          </mesh>
        </group>
      );
    case 'fallen_pole':
      return (
        <mesh position={[x, 1.2, relativeZ]} rotation={[0, 0, Math.PI * 0.4]}>
          <cylinderGeometry args={[0.06, 0.06, 4.5]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />
        </mesh>
      );
    case 'scaffolding':
      return (
        <group position={[x, 0, relativeZ]}>
          {[[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].map(([px, pz], i) => (
            <mesh key={i} position={[px, 1.5, pz]}>
              <cylinderGeometry args={[0.04, 0.04, 3]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 2.8, 0]}>
            <boxGeometry args={[2.5, 0.06, 1.2]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      );
  }
}

// ============================================================================
// Orbs
// ============================================================================

function OrbMesh({ orb, playerY }: { orb: RunnerOrb; playerY: number }) {
  const relativeZ = orb.y - playerY;
  if (relativeZ < -3 || relativeZ > 60) return null;
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = 1.2 + Math.sin(state.clock.elapsedTime * 3 + orb.id) * 0.15;
    meshRef.current.rotation.y += 0.02;
  });

  const x = LANE_X[orb.lane];
  const radius = orb.kind === 'clothing' ? 0.35 : orb.kind === 'shadow' ? 0.25 : 0.2;
  const intensity = orb.kind === 'shadow' ? 2 : orb.kind === 'clothing' ? 5 : 4;

  return (
    <mesh ref={meshRef} position={[x, 1.2, relativeZ]}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color={orb.color} emissive={orb.color} emissiveIntensity={intensity} />
    </mesh>
  );
}

// ============================================================================
// Chase Camera — matches Blender camera: pos=[0,-1,5.5], rot=60°, fov=59°
// ============================================================================

function ChaseCamera({ playerY, playerLane }: { playerY: number; playerLane: RunnerLane }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const laneX = LANE_X[playerLane] * 0.3;
    const lerp = Math.min(1, delta * 4);

    // Behind and above player, looking down the road
    // Blender camera: [0, -1, 5.5] with 60° X rotation
    // After axis swap: position at [0, 5.5, 1] looking forward
    const targetPos = new THREE.Vector3(laneX, 5.5, -8);
    camera.position.lerp(targetPos, lerp);

    // Look ahead along the road
    const lookAt = new THREE.Vector3(laneX * 0.5, 1.5, 10);
    camera.lookAt(lookAt);
  });

  return null;
}
