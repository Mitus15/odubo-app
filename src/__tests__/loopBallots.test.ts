/**
 * The ballot layer's pure/structural rules. The SQL paths run against
 * production D1 and are exercised in dev; what the suite pins down is the
 * scoping and identity logic that keeps ballot votes and anthem votes from
 * ever colliding.
 */
import { ballotScope, wallCode, BALLOT_VOTE_LIMIT } from "@/lib/loop/ballots";

describe("ballotScope", () => {
  it("scopes each ballot under a distinct synthetic event id", () => {
    expect(ballotScope("vol-1", "tracklist")).toBe("vol-1#tracklist");
    expect(ballotScope("vol-1", "cover")).toBe("vol-1#cover");
  });

  it("can never collide with a real event id or the other ballot", () => {
    // Real event ids don't contain '#' — the separator is structural, so the
    // anthem's own upvotes (keyed by the bare event id) stay untouchable.
    const scopes = [
      "vol-1",
      ballotScope("vol-1", "tracklist"),
      ballotScope("vol-1", "cover"),
      ballotScope("vol-2", "tracklist"),
    ];
    expect(new Set(scopes).size).toBe(scopes.length);
  });
});

describe("wallCode", () => {
  it("derives the volume's gallery code from the event id", () => {
    // The real Vol 1 gallery is code LOOPVOL1 — this is what wires the cover
    // ballot to the actual Wall.
    expect(wallCode("vol-1")).toBe("LOOPVOL1");
    expect(wallCode("vol-2")).toBe("LOOPVOL2");
  });
});

describe("vote budget", () => {
  it("matches the anthem's scarcity philosophy", () => {
    // Scarce likes are the whole reason a leaderboard reflects favourites
    // rather than click volume; if this changes, change it on purpose.
    expect(BALLOT_VOTE_LIMIT).toBe(3);
  });
});
