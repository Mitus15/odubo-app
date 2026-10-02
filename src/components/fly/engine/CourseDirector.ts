import type { Course } from './course';
import { composeSection, MAX_FLOOR_HALF, type Section } from './patterns';
import type { Floor, Form } from './types';

/** Built this far below him (m). Fog swallows it before this. */
export const AHEAD = 520;
/** Kept until everything in a section is this far above him (m). */
export const BEHIND = 30;

interface Built extends Section {
  /** The lowest point anything in the section reaches. */
  bottom: number;
}

/**
 * Keeps the part of a course near him built: sections are composed as he
 * nears them and let go once everything in them is above him. Sections are
 * pure functions of the course, so building, dropping and rebuilding one
 * always gives the same stone.
 */
export class CourseDirector {
  course: Course;
  private sections = new Map<number, Built>();
  private added: Form[] = [];
  private removed: Form[] = [];
  /** Sections low..high are built (or were, and have been let go below low). */
  private low = 0;
  private high = -1;

  constructor(course: Course) {
    this.course = course;
  }

  /** Start over on another course (or the same one, from the top). */
  reset(course: Course): void {
    for (const section of this.sections.values()) this.removed.push(...section.forms);
    this.sections.clear();
    this.course = course;
    this.low = 0;
    this.high = -1;
  }

  /** Build what is near s and let go of what is well above it. */
  update(s: number): void {
    const course = this.course;
    const high = course.sectionAt(s + AHEAD);
    // A jump (a run started deep, or a fast-forward) skips what is long gone.
    const skipTo = Math.max(0, course.sectionAt(s - BEHIND) - 2);
    if (skipTo > this.high + 1) {
      for (const k of [...this.sections.keys()]) this.drop(k);
      this.low = skipTo;
      this.high = skipTo - 1;
    }
    for (let k = this.high + 1; k <= high; k++) this.build(k);
    if (high > this.high) this.high = high;

    while (this.low < this.high) {
      const section = this.sections.get(this.low);
      if (section && section.bottom >= s - BEHIND) break;
      this.drop(this.low);
      this.low += 1;
    }
  }

  section(k: number): Section | undefined {
    return this.sections.get(k);
  }

  /**
   * Replace section k with hand-placed stone. For tests (a pillar exactly
   * here, a hole exactly there); a course never needs it.
   */
  inject(k: number, section: Section): void {
    this.drop(k);
    this.sections.set(k, { ...section, bottom: Infinity });
    this.added.push(...section.forms);
    if (k < this.low) this.low = k;
    if (k > this.high) this.high = k;
  }

  floor(k: number): Floor | null {
    return this.sections.get(k)?.floor ?? null;
  }

  /** Every form currently built. */
  forms(): Form[] {
    const all: Form[] = [];
    for (const section of this.sections.values()) all.push(...section.forms);
    return all;
  }

  get formCount(): number {
    let count = 0;
    for (const section of this.sections.values()) count += section.forms.length;
    return count;
  }

  /**
   * Visit the forms whose extent along the fall comes within `reach` of s.
   * Floors, pillars, shards and gates stay inside their own section, so only
   * the sections around s need looking at. (Scenery may not; it is never solid.)
   */
  forEachNear(s: number, reach: number, visit: (form: Form) => void): void {
    const course = this.course;
    const from = Math.max(this.low, course.sectionAt(s - reach - MAX_FLOOR_HALF) - 1);
    const to = Math.min(this.high, course.sectionAt(s + reach + MAX_FLOOR_HALF));
    for (let k = from; k <= to; k++) {
      const section = this.sections.get(k);
      if (!section) continue;
      for (const form of section.forms) {
        if (form.role === 'scenery') continue;
        const gap = form.s - s;
        if ((gap < 0 ? -gap : gap) <= reach + form.hs) visit(form);
      }
    }
  }

  /** Forms added and removed since the last call, for the renderer. */
  drainChanges(): { added: Form[]; removed: Form[] } {
    const changes = { added: this.added, removed: this.removed };
    this.added = [];
    this.removed = [];
    return changes;
  }

  private build(k: number): void {
    if (this.sections.has(k)) return;
    const section = composeSection(this.course, k);
    let bottom = this.course.floorS(k + 1);
    for (const form of section.forms) {
      const reach = form.s + form.hs;
      if (reach > bottom) bottom = reach;
    }
    this.sections.set(k, { ...section, bottom });
    this.added.push(...section.forms);
  }

  private drop(k: number): void {
    const section = this.sections.get(k);
    if (!section) return;
    this.sections.delete(k);
    this.removed.push(...section.forms);
  }
}
