import type { FormKind } from '../engine/types';

/**
 * How many forms of each kind the world can draw at once. One instanced mesh
 * per kind, so this costs memory, not draw calls. A lattice floor is cut into
 * many pieces: the busiest level at top speed needs about 1,300 blocks, and
 * flyPools.test.ts checks every level stays under these with room to spare.
 */
export const POOL_CAPACITY: Record<FormKind, number> = { block: 2048, prism: 320, ring: 32 };
