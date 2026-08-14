import type { AnthemState } from "@/lib/loop/anthem-server";
import type { Track, Round } from "@/lib/loop/anthem";
import type { PosterSize, TournamentArt, TournamentPair, TournamentPosterSpec } from "./layout";

/**
 * AnthemState → TournamentPosterSpec, pure. This is the only file that knows
 * both the anthem's shape and the poster's; the layout stays anthem-agnostic
 * and this mapper stays geometry-agnostic. All imports from the anthem side
 * are type-only, so the browser can bundle it without dragging in D1.
 *
 * Correctness rules carried here, not in the layout:
 * - `gate` gates SUGGESTING, never voting — the vote CTA is identical in both
 *   gate modes; a gate-varying vote CTA would print a lie.
 * - Printed countdowns go stale: `print` gets absolute dates, story/feed get
 *   relative ones.
 * - Artwork guards are truthiness, never `!== null` — the DB stores "" for a
 *   track without art.
 */

/** The crowd holds the grid when nothing is nominated yet. */
export const TOURNAMENT_EMPTY_FIGURE = "/loop/figures/crowd.png";

/** Most artwork the nominating grid will quote before it stops adding tiles. */
const GRID_MAX = 12;

/**
 * Single indirection for artwork URLs. Stored artwork is 600px (2in at
 * 300dpi) — print upsizes through Apple's size-in-path scheme. If mzstatic
 * ever needs a proxy, this is the one line that changes.
 */
export function artUrl(url: string | null | undefined, size: PosterSize): string {
  if (!url) return "";
  return size === "print" ? url.replace(/\/\d+x\d+bb\./, "/1500x1500bb.") : url;
}

function toArt(
  t: { title: string; artist: string; artworkUrl: string | null },
  size: PosterSize,
): TournamentArt {
  return { src: artUrl(t.artworkUrl, size), title: t.title.toUpperCase(), artist: t.artist.toUpperCase() };
}

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/**
 * "CLOSES …" for a cutoff. Absolute for print (a printed relative date is
 * stale the moment it leaves the printer); relative for story/feed, which
 * live for hours.
 */
export function closesLine(closesAt: number, size: PosterSize, now: number): string {
  const d = new Date(closesAt);
  if (size === "print") return `CLOSES ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const ms = closesAt - now;
  if (ms <= 0) return "CLOSED";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "CLOSES WITHIN THE HOUR";
  if (hours < 24) return `CLOSES IN ${hours} HOURS`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "CLOSES TOMORROW" : `CLOSES IN ${days} DAYS`;
}

function activeRoundOf(state: AnthemState): Round | null {
  const b = state.bracket;
  if (!b || b.rounds.length === 0) return null;
  if (b.activeRound != null) {
    const r = b.rounds.find((x) => x.round === b.activeRound);
    if (r) return r;
  }
  // Between rounds (or all closed): show the last round that has matchups.
  return b.rounds[b.rounds.length - 1] ?? null;
}

export function tournamentSpec(
  state: AnthemState,
  opts: { size: PosterSize; qrUrl: string; now?: number },
): TournamentPosterSpec {
  const { size, qrUrl } = opts;
  const now = opts.now ?? state.serverNow;
  const base = { size, qrUrl };

  switch (state.stage) {
    case "nominating": {
      const rows = state.leaderboard;
      const art = rows.slice(0, GRID_MAX).map((r) => toArt(r.candidate, size));
      const n = rows.length;
      const leader = rows[0];
      const closes = closesLine(state.schedule.nominations, size, now).replace(
        "CLOSES",
        "NOMINATIONS CLOSE",
      );
      // An empty longlist is an invitation, not a count — "0 SONGS NOMINATED"
      // is the one honest headline that would still sink the poster.
      const headline =
        n === 0 ? "THE FLOOR IS OPEN" : n === 1 ? "1 SONG NOMINATED" : `${n} SONGS NOMINATED`;
      const sublines =
        n === 0
          ? ["BE THE FIRST TO NOMINATE", closes]
          : [leader ? `LEADING · ${leader.candidate.title.toUpperCase()}` : closes, closes];
      return {
        ...base,
        band: { kind: "grid", art, emptyFigureSrc: TOURNAMENT_EMPTY_FIGURE },
        headline,
        sublines: [...new Set(sublines)],
        // The gate decides who may SUGGEST; upvoting is open to everyone.
        cta: state.gate === "open" ? "SCAN TO NOMINATE" : "SCAN TO UPVOTE",
      };
    }

    case "seeding": {
      // Seeds may not be locked yet while the admin is picking — the top of
      // the leaderboard is the honest picture until they are.
      const source: { title: string; artist: string; artworkUrl: string | null }[] =
        state.seeds ?? state.leaderboard.map((r) => r.candidate);
      return {
        ...base,
        band: { kind: "seeds", art: source.slice(0, 8).map((t) => toArt(t, size)) },
        headline: "THE LONGLIST IS LOCKED",
        sublines: ["EIGHT ADVANCE TO THE BRACKET"],
        cta: "SCAN FOR THE DRAW",
      };
    }

    case "bracket": {
      const round = activeRoundOf(state);
      if (!round) {
        // Bracket stage with no derivable round — fall back to the seed wall
        // rather than refuse; the data will catch up.
        return {
          ...base,
          band: { kind: "seeds", art: (state.seeds ?? []).slice(0, 8).map((t) => toArt(t, size)) },
          headline: "THE BRACKET IS COMING",
          sublines: [],
          cta: "SCAN TO VOTE",
        };
      }
      const pairs: TournamentPair[] = round.matchups.map((m) => {
        const total = m.votesA + m.votesB;
        return {
          a: m.a ? toArt(m.a, size) : null,
          b: m.b ? toArt(m.b, size) : null,
          pctA: total > 0 ? m.votesA / total : null,
        };
      });
      return {
        ...base,
        band: { kind: "pairs", pairs },
        headline: round.name.toUpperCase(),
        sublines: [closesLine(round.closesAt, size, now).replace("CLOSES", "VOTING CLOSES")],
        // Identical in both gate modes — everyone votes.
        cta: "SCAN TO VOTE",
      };
    }

    case "champion": {
      const champion: Track | null = state.bracket?.champion ?? null;
      const art: TournamentArt = champion
        ? toArt(champion, size)
        : { src: "", title: "THE SOUL ANTHEM", artist: "" };
      return {
        ...base,
        band: { kind: "hero", art },
        headline: champion ? champion.title.toUpperCase() : "THE SOUL ANTHEM",
        sublines: champion ? [champion.artist.toUpperCase(), "THE SOUL ANTHEM · DECIDED BY THE ROOM"] : [],
        cta: "SCAN FOR PASSES",
      };
    }
  }
}
