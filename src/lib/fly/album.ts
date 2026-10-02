import shape from '../../../data/loop/film/shape.json';
import { SONGS, type Song } from '@/lib/loop/songs';
import type { MedalRates } from './rules';

/**
 * Loop Soul as the fall plays it: the intro and the three interludes are
 * cutscenes, every other song is a level. One list, in album order, for both
 * modes: Songs plays any level alone, Album plays the whole list through.
 *
 * Everything a course is built from lives here and in the repo's own data
 * (songs.json, shape.json), never in the database, so the same song is the
 * same course on every phone and on the server that will check runs.
 */

export type PatternName = 'plates' | 'grid' | 'oneway' | 'crack' | 'open';

/** What a course is made of. The seed comes from `key` and COURSE_VERSION. */
export interface CourseSpec {
  key: number;
  /** Length of the run (s); Infinity for the title screen's endless fall. */
  seconds: number;
  /** 1..10 for levels; 0 for the title and the cutscenes. */
  levelIndex: number;
  /** Metres between floors. */
  spacing: number;
  /** How often each kind of floor comes up. */
  mix: Readonly<Record<PatternName, number>>;
  /** 0..1: how many pillars, shards and gates fill the air between floors. */
  pillars: number;
  shards: number;
  gates: number;
  /** Added to the depth-driven intensity. */
  difficulty: number;
  /** From this second the stone stops being solid (the landing). */
  harmlessFrom: number | null;
}

export interface LevelDef {
  kind: 'level';
  slug: string;
  /** Track number on the album, 1..14. */
  number: number;
  /** Level number, 1..10. */
  index: number;
  title: string;
  seconds: number;
  trackId: string;
  bpm: number;
  /** Where the song lets go (s). */
  fallsAwayAt: number;
  /** His shadow keeps his time, or lags a beat behind (The Game's pull). */
  shadow: 'sync' | 'lag';
  /** The last level: the ground comes up to meet him. */
  landing: boolean;
  /** Bronze, silver and gold, as average fall speeds (m/s). */
  medals: MedalRates;
  course: CourseSpec;
}

export type CutsceneScript = 'welcome' | 'stratum';

export interface CutsceneDef {
  kind: 'cutscene';
  slug: string;
  number: number;
  title: string;
  seconds: number;
  trackId: string;
  bpm: number;
  fallsAwayAt: number;
  script: CutsceneScript;
  course: CourseSpec;
}

export type Stage = LevelDef | CutsceneDef;

interface ShapeSong {
  slug: string;
  bpm: number;
  fallsAwayAt: number;
  contour16: number[];
  perSecond: number[];
}

const SHAPES = new Map<string, ShapeSong>((shape.songs as ShapeSong[]).map((song) => [song.slug, song]));

/** A floor every whole number of beats, as close to `target` metres as the tempo allows. */
export function spacingFor(bpm: number, target: number): number {
  const beatMetres = (60 / bpm) * 30;
  const beats = Math.max(1, Math.round(target / beatMetres));
  return Math.min(90, Math.max(55, beats * beatMetres));
}

interface LevelRecipe {
  target: number;
  /** Bronze, silver, gold (m/s), measured with bots; flyMedals.test.ts keeps them honest. */
  medals: [number, number, number];
  mix: Partial<Record<PatternName, number>>;
  pillars: number;
  shards: number;
  gates: number;
  difficulty?: number;
}

/**
 * Each level brings one new thing and keeps what came before. A draft for the
 * owner to correct; the courses only change when COURSE_VERSION does.
 */
const RECIPES: Record<string, LevelRecipe> = {
  // Plates and pillars, generous: learning to fall.
  '1984': { target: 72, medals: [34, 46, 58], mix: { plates: 5, open: 1 }, pillars: 0.45, shards: 0.15, gates: 0.3 },
  // The grid arrives.
  hallucinogen: { target: 70, medals: [34, 38, 45], mix: { plates: 3, grid: 3, open: 1 }, pillars: 0.4, shards: 0.35, gates: 0.25 },
  // One way through: walls with a single door, gates to keep you honest.
  'in-the-court': { target: 72, medals: [34, 40, 48], mix: { oneway: 4, plates: 2, grid: 1, open: 0.6 }, pillars: 0.6, shards: 0.2, gates: 0.6 },
  // Lattices: the highest altitude, The Game's strongest pull.
  newspeak: { target: 68, medals: [34, 38, 45], mix: { grid: 4, plates: 2, oneway: 1, open: 0.6 }, pillars: 0.4, shards: 0.3, gates: 0.35 },
  // Pillar forests.
  rap: { target: 70, medals: [34, 44, 54], mix: { plates: 3, grid: 1, crack: 1, open: 0.6 }, pillars: 1, shards: 0.3, gates: 0.3 },
  // Cracks, and open air between them.
  makunahea: { target: 72, medals: [34, 44, 53], mix: { crack: 4, plates: 2, open: 2 }, pillars: 0.3, shards: 0.2, gates: 0.5 },
  // Still air: sparse, long and quiet.
  'the-other-side': { target: 85, medals: [34, 40, 50], mix: { plates: 2, oneway: 1, open: 4 }, pillars: 0.45, shards: 0.1, gates: 0.95 },
  // The wrestle: everything, tightest.
  'the-mind-pt-1': { target: 62, medals: [34, 38, 45], mix: { plates: 2, grid: 2, oneway: 2, crack: 2, open: 0.5 }, pillars: 0.8, shards: 0.6, gates: 0.3, difficulty: 0.08 },
  // Coming out of the Mind.
  'the-mind-pt-2': { target: 68, medals: [34, 38, 45], mix: { grid: 3, plates: 2, crack: 1, open: 1 }, pillars: 0.7, shards: 0.4, gates: 0.35 },
  // One way out, narrowing, then the ground.
  'ghost-world': { target: 72, medals: [34, 40, 47], mix: { oneway: 5, plates: 1, open: 1 }, pillars: 0.35, shards: 0.2, gates: 0.5, difficulty: 0.05 },
};

const LAG = new Set(['1984', 'newspeak', 'the-mind-pt-1']);

const ALL_PATTERNS: Record<PatternName, number> = { plates: 0, grid: 0, oneway: 0, crack: 0, open: 0 };

function shapeOf(song: Song): ShapeSong {
  const found = SHAPES.get(song.slug);
  if (!found) throw new Error(`No measured shape for ${song.slug}`);
  return found;
}

function buildStages(): Stage[] {
  const stages: Stage[] = [];
  let index = 0;
  for (const song of SONGS) {
    const measured = shapeOf(song);
    const recipe = RECIPES[song.slug];
    if (song.interlude || !recipe) {
      stages.push({
        kind: 'cutscene',
        slug: song.slug,
        number: song.number,
        title: song.title,
        seconds: song.seconds,
        trackId: song.trackId,
        bpm: measured.bpm,
        fallsAwayAt: measured.fallsAwayAt,
        script: song.number === 1 ? 'welcome' : 'stratum',
        course: {
          key: 1000 + song.number,
          seconds: song.seconds,
          levelIndex: 0,
          spacing: spacingFor(measured.bpm, 80),
          mix: { ...ALL_PATTERNS, open: 1 },
          pillars: 0,
          shards: 0,
          gates: 0,
          difficulty: 0,
          harmlessFrom: 0,
        },
      });
      continue;
    }
    index += 1;
    const landing = song.slug === 'ghost-world';
    stages.push({
      kind: 'level',
      slug: song.slug,
      number: song.number,
      index,
      title: song.title,
      seconds: song.seconds,
      trackId: song.trackId,
      bpm: measured.bpm,
      fallsAwayAt: measured.fallsAwayAt,
      shadow: LAG.has(song.slug) ? 'lag' : 'sync',
      landing,
      medals: { bronze: recipe.medals[0], silver: recipe.medals[1], gold: recipe.medals[2] },
      course: {
        key: song.number,
        seconds: song.seconds,
        levelIndex: index,
        spacing: spacingFor(measured.bpm, recipe.target),
        mix: { ...ALL_PATTERNS, ...recipe.mix },
        pillars: recipe.pillars,
        shards: recipe.shards,
        gates: recipe.gates,
        difficulty: recipe.difficulty ?? 0,
        harmlessFrom: landing ? measured.fallsAwayAt : null,
      },
    });
  }
  return stages;
}

/** The album in order: four cutscenes and ten levels. */
export const STAGES: readonly Stage[] = buildStages();

export const LEVELS: readonly LevelDef[] = STAGES.filter((stage): stage is LevelDef => stage.kind === 'level');

export function stageBySlug(slug: string): Stage | null {
  return STAGES.find((stage) => stage.slug === slug) ?? null;
}

export function levelBySlug(slug: string): LevelDef | null {
  return LEVELS.find((level) => level.slug === slug) ?? null;
}

/** The title screen's fall: endless and gentle, the same every visit. */
export const ATTRACT_COURSE: CourseSpec = {
  key: 9001,
  seconds: Infinity,
  levelIndex: 0,
  spacing: 78,
  mix: { plates: 4, grid: 1, oneway: 0, crack: 1, open: 1.4 },
  pillars: 0.4,
  shards: 0.2,
  gates: 0.3,
  difficulty: 0,
  harmlessFrom: null,
};

/** The song's loudness, second by second (LUFS), for light that breathes with it. */
export function loudnessOf(slug: string): readonly number[] {
  return SHAPES.get(slug)?.perSecond ?? [];
}
