/**
 * The capture rules that decide how long a take may run and which recording
 * path it uses. Both are pure, both are load-bearing, and both were previously
 * scattered as literals across three files.
 */
import {
  CLIP_LIMITS,
  clipLimitS,
  formatClock,
  isLongTake,
} from "@/lib/loop/pose/limits";
import { extensionFor, downloadName } from "@/lib/loop/media/filename";

describe("clipLimitS", () => {
  it("gives guests the same short clip whatever the filter is doing", () => {
    // A guest's limit is about the phone in their hand and the moment being a
    // moment — the filter doesn't enter into it.
    expect(clipLimitS(false, true)).toBe(CLIP_LIMITS.guest);
    expect(clipLimitS(false, false)).toBe(CLIP_LIMITS.guest);
  });

  it("keeps a FILTERED studio take short", () => {
    // Segmentation plus the vector redraw is per-frame CPU that no phone holds
    // for minutes. If this ever grows, it is because a device was measured.
    expect(clipLimitS(true, true)).toBe(CLIP_LIMITS.studioFiltered);
  });

  it("gives the raw studio take the full five minutes", () => {
    expect(clipLimitS(true, false)).toBe(CLIP_LIMITS.studioRaw);
    expect(CLIP_LIMITS.studioRaw).toBe(300);
  });

  it("never lets a filtered take outrun a raw one", () => {
    expect(CLIP_LIMITS.guest).toBeLessThanOrEqual(CLIP_LIMITS.studioFiltered);
    expect(CLIP_LIMITS.studioFiltered).toBeLessThan(CLIP_LIMITS.studioRaw);
  });
});

describe("isLongTake", () => {
  it("is the studio + video + unfiltered corner, and only that", () => {
    expect(isLongTake(true, "video", false)).toBe(true);
    // Filtered studio video still goes through the canvas — that IS the look.
    expect(isLongTake(true, "video", true)).toBe(false);
    // Photo never qualifies: the shutter already reads full sensor resolution.
    expect(isLongTake(true, "photo", false)).toBe(false);
    // A guest never gets the direct-stream path.
    expect(isLongTake(false, "video", false)).toBe(false);
  });
});

describe("extensionFor", () => {
  it("follows the blob's real type, not the media kind", () => {
    // The bug this replaced: Safari records MP4 from a list that starts with
    // mp4/h264, and the name said ".webm" — which some apps reject outright.
    expect(extensionFor(new Blob([], { type: "video/mp4;codecs=h264" }), "video")).toBe("mp4");
    expect(extensionFor(new Blob([], { type: "video/webm;codecs=vp9" }), "video")).toBe("webm");
  });

  it("falls back to webm for a video with no usable type", () => {
    expect(extensionFor(new Blob([], { type: "" }), "video")).toBe("webm");
  });

  it("names stills by their encoding", () => {
    expect(extensionFor(new Blob([], { type: "image/jpeg" }), "image")).toBe("jpg");
    expect(extensionFor(new Blob([], { type: "image/png" }), "image")).toBe("png");
  });

  it("stamps downloads so repeated takes don't collide", () => {
    const blob = new Blob([], { type: "video/mp4" });
    expect(downloadName(blob, "video", 1234)).toBe("loop-soul-1234.mp4");
  });
});

describe("formatClock", () => {
  it("reads as a recording timer", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(167)).toBe("2:47");
    expect(formatClock(CLIP_LIMITS.studioRaw)).toBe("5:00");
  });

  it("never shows a negative clock when the take overruns its cap", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});
