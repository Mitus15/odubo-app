/**
 * @jest-environment node
 *
 * Who may hear a recording. Pure rule, no database.
 *
 * Written after finding the unreleased album streamable by anyone in
 * production: /api/tracks handed out every audio URL and both byte routes
 * answered an anonymous range request with real audio.
 */
import { decideAudioAccess, type AudioFacts } from "@/lib/loop/audioAccess";

const facts = (o: Partial<AudioFacts> = {}): AudioFacts => ({
  albumPublished: false,
  isFeaturedSingle: false,
  isAdmin: false,
  owed: false,
  albumReleased: false,
  inEarlySet: false,
  ...o,
});

describe("decideAudioAccess", () => {
  it("refuses a stranger the unreleased record", () => {
    expect(decideAudioAccess(facts())).toBe(false);
  });

  it("keeps a published catalogue public", () => {
    expect(decideAudioAccess(facts({ albumPublished: true }))).toBe(true);
  });

  it("keeps the single public, because the flyer promises it", () => {
    expect(decideAudioAccess(facts({ isFeaturedSingle: true }))).toBe(true);
  });

  it("lets a verified admin hear a draft", () => {
    expect(decideAudioAccess(facts({ isAdmin: true }))).toBe(true);
  });

  it("gives a pass-holder only their own draw before release", () => {
    expect(decideAudioAccess(facts({ owed: true, inEarlySet: true }))).toBe(true);
    expect(decideAudioAccess(facts({ owed: true, inEarlySet: false }))).toBe(false);
  });

  it("opens the whole record to a pass-holder once it is released", () => {
    expect(decideAudioAccess(facts({ owed: true, albumReleased: true, inEarlySet: false }))).toBe(true);
  });

  it("still refuses someone who is not owed it, even after release", () => {
    expect(decideAudioAccess(facts({ owed: false, albumReleased: true }))).toBe(false);
  });
});
