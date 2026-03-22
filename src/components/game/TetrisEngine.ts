// ============================================================================
// TetrisEngine — Pure TypeScript game logic (no React)
// ============================================================================

import type { Cell, Grid, Piece, GameState } from '@/types/game';

// Grid dimensions
const COLS = 10;
const ROWS = 20;

// 7 tetrominoes (SRS standard)
// Each defined in spawn orientation (rotation 0)
const TETROMINOES: boolean[][][] = [
  // 1: I
  [
    [false, false, false, false],
    [true, true, true, true],
    [false, false, false, false],
    [false, false, false, false],
  ],
  // 2: J
  [
    [true, false, false],
    [true, true, true],
    [false, false, false],
  ],
  // 3: L
  [
    [false, false, true],
    [true, true, true],
    [false, false, false],
  ],
  // 4: O
  [
    [true, true],
    [true, true],
  ],
  // 5: S
  [
    [false, true, true],
    [true, true, false],
    [false, false, false],
  ],
  // 6: T
  [
    [false, true, false],
    [true, true, true],
    [false, false, false],
  ],
  // 7: Z
  [
    [true, true, false],
    [false, true, true],
    [false, false, false],
  ],
];

// SRS wall kick data for J, L, S, T, Z pieces
const WALL_KICKS: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

// SRS wall kick data for I piece
const I_WALL_KICKS: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// NES-style scoring
const LINE_SCORES = [0, 100, 300, 500, 800];

// Gravity speeds (ms per drop) by level
function getDropInterval(level: number): number {
  const speeds = [800, 720, 630, 550, 470, 380, 300, 220, 150, 100, 80, 70, 60, 50, 40, 30, 25, 20, 15, 10];
  return speeds[Math.min(level, speeds.length - 1)];
}

function createEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

function rotateShape(shape: boolean[][]): boolean[][] {
  const size = shape.length;
  const rotated: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      rotated[c][size - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

export class TetrisEngine {
  grid: Grid;
  currentPiece: Piece | null = null;
  nextPiece: Piece | null = null;
  score = 0;
  level = 1;
  linesCleared = 0;
  gameOver = false;

  private bag: number[] = [];
  private dropTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private lockDelay: ReturnType<typeof setTimeout> | null = null;

  onStateChange: ((state: GameState) => void) | null = null;
  onGameOver: ((score: number, level: number, lines: number, durationSeconds: number) => void) | null = null;

  constructor() {
    this.grid = createEmptyGrid();
  }

  start(): void {
    this.grid = createEmptyGrid();
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.gameOver = false;
    this.bag = [];
    this.startTime = Date.now();

    this.nextPiece = this.generatePiece();
    this.spawnPiece();
    this.startGravity();
    this.emitState();
  }

  stop(): void {
    this.clearTimers();
  }

  // ========================================================================
  // Piece generation (7-bag randomizer)
  // ========================================================================

  private refillBag(): void {
    this.bag = [1, 2, 3, 4, 5, 6, 7];
    // Fisher-Yates shuffle
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  private generatePiece(): Piece {
    if (this.bag.length === 0) this.refillBag();
    const type = this.bag.pop()!;
    const shape = TETROMINOES[type - 1];
    const x = Math.floor((COLS - shape[0].length) / 2);
    return { shape, x, y: 0, type, rotation: 0 };
  }

  private spawnPiece(): void {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.generatePiece();

    if (this.currentPiece && this.checkCollision(this.currentPiece)) {
      this.gameOver = true;
      this.clearTimers();
      this.emitState();
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.onGameOver?.(this.score, this.level, this.linesCleared, duration);
    }
  }

  // ========================================================================
  // Collision detection
  // ========================================================================

  private checkCollision(piece: Piece, offsetX = 0, offsetY = 0, shape?: boolean[][]): boolean {
    const s = shape || piece.shape;
    for (let r = 0; r < s.length; r++) {
      for (let c = 0; c < s[r].length; c++) {
        if (!s[r][c]) continue;
        const newX = piece.x + c + offsetX;
        const newY = piece.y + r + offsetY;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY >= 0 && this.grid[newY][newX] !== 0) return true;
      }
    }
    return false;
  }

  // ========================================================================
  // Movement
  // ========================================================================

  moveLeft(): void {
    if (!this.currentPiece || this.gameOver) return;
    if (!this.checkCollision(this.currentPiece, -1, 0)) {
      this.currentPiece.x -= 1;
      this.cancelLockDelay();
      this.emitState();
    }
  }

  moveRight(): void {
    if (!this.currentPiece || this.gameOver) return;
    if (!this.checkCollision(this.currentPiece, 1, 0)) {
      this.currentPiece.x += 1;
      this.cancelLockDelay();
      this.emitState();
    }
  }

  moveDown(): boolean {
    if (!this.currentPiece || this.gameOver) return false;
    if (!this.checkCollision(this.currentPiece, 0, 1)) {
      this.currentPiece.y += 1;
      this.cancelLockDelay();
      this.emitState();
      return true;
    }
    this.scheduleLock();
    return false;
  }

  hardDrop(): void {
    if (!this.currentPiece || this.gameOver) return;
    let dropDistance = 0;
    while (!this.checkCollision(this.currentPiece, 0, dropDistance + 1)) {
      dropDistance++;
    }
    this.currentPiece.y += dropDistance;
    this.score += dropDistance * 2; // Hard drop bonus
    this.lockPiece();
  }

  rotate(): void {
    if (!this.currentPiece || this.gameOver) return;
    // O piece doesn't rotate
    if (this.currentPiece.type === 4) return;

    const oldRotation = this.currentPiece.rotation;
    const newRotation = (oldRotation + 1) % 4;
    const newShape = rotateShape(this.currentPiece.shape);
    const kickKey = `${oldRotation}>${newRotation}`;
    const kicks = this.currentPiece.type === 1 ? I_WALL_KICKS[kickKey] : WALL_KICKS[kickKey];

    if (!kicks) return;

    for (const [dx, dy] of kicks) {
      if (!this.checkCollision(this.currentPiece, dx, -dy, newShape)) {
        this.currentPiece.shape = newShape;
        this.currentPiece.x += dx;
        this.currentPiece.y -= dy;
        this.currentPiece.rotation = newRotation;
        this.cancelLockDelay();
        this.emitState();
        return;
      }
    }
  }

  // ========================================================================
  // Lock piece + line clearing
  // ========================================================================

  private scheduleLock(): void {
    if (this.lockDelay) return;
    this.lockDelay = setTimeout(() => {
      this.lockDelay = null;
      if (this.currentPiece && this.checkCollision(this.currentPiece, 0, 1)) {
        this.lockPiece();
      }
    }, 500);
  }

  private cancelLockDelay(): void {
    if (this.lockDelay) {
      clearTimeout(this.lockDelay);
      this.lockDelay = null;
    }
  }

  private lockPiece(): void {
    if (!this.currentPiece) return;
    this.cancelLockDelay();

    const { shape, x, y, type } = this.currentPiece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const gridY = y + r;
        const gridX = x + c;
        if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
          this.grid[gridY][gridX] = type as Cell;
        }
      }
    }

    const cleared = this.clearLines();
    if (cleared > 0) {
      this.linesCleared += cleared;
      this.score += LINE_SCORES[cleared] * this.level;
      // Level up every 10 lines
      const newLevel = Math.floor(this.linesCleared / 10) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.restartGravity();
      }
    }

    this.spawnPiece();
    this.emitState();
  }

  private clearLines(): number {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== 0)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0) as Cell[]);
        cleared++;
        r++; // Recheck same row index
      }
    }
    return cleared;
  }

  // ========================================================================
  // Ghost piece (landing preview)
  // ========================================================================

  getGhostY(): number | null {
    if (!this.currentPiece) return null;
    let ghostOffset = 0;
    while (!this.checkCollision(this.currentPiece, 0, ghostOffset + 1)) {
      ghostOffset++;
    }
    return this.currentPiece.y + ghostOffset;
  }

  // ========================================================================
  // Gravity / timing
  // ========================================================================

  private startGravity(): void {
    this.clearGravity();
    this.dropTimer = setInterval(() => {
      this.tick();
    }, getDropInterval(this.level));
  }

  private restartGravity(): void {
    this.startGravity();
  }

  private clearGravity(): void {
    if (this.dropTimer) {
      clearInterval(this.dropTimer);
      this.dropTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearGravity();
    this.cancelLockDelay();
  }

  tick(): void {
    if (this.gameOver) return;
    this.moveDown();
  }

  // ========================================================================
  // State emission
  // ========================================================================

  getState(): GameState {
    return {
      grid: this.grid,
      currentPiece: this.currentPiece,
      nextPiece: this.nextPiece,
      score: this.score,
      level: this.level,
      linesCleared: this.linesCleared,
      gameOver: this.gameOver,
      ghostY: this.getGhostY(),
    };
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }
}

export { COLS, ROWS };
