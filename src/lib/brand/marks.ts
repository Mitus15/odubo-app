/**
 * The Odubo Studio marks. Every surface takes its logo from here, never from
 * a hardcoded path, so the next change to the logo is one line.
 *
 * Adopted 2026-09-29 (owner): ODUBO in Libre Baskerville Bold over the
 * danceman. It replaced two lockups at once, the brush ODUBO on the site and
 * the MadisonSquare one on the posters. See docs/decisions/odubo-logo.md.
 *
 * The rule between the two files is size. Below ~96px tall the lockup's word
 * drops under 12px and stops reading, so small places (headers, modals, icon
 * tiles) carry the danceman alone. He is the house mark on his own.
 */

/** ODUBO over the danceman. Oxblood, recolourable through the root fill. */
export const ODUBO_LOCKUP = "/brand-logos/odubo-brand/odubo-lockup.svg";
/** Width over height of the lockup's viewBox (1043.46 × 1200). */
export const ODUBO_LOCKUP_ASPECT = 1043.46 / 1200;

/** The danceman alone, for anywhere the lockup would be under ~96px tall. */
export const ODUBO_MARK = "/brand-logos/odubo-brand/odubo-mark.svg";
/** Width over height of the mark's viewBox (953.36 × 1200). */
export const ODUBO_MARK_ASPECT = 953.36 / 1200;
