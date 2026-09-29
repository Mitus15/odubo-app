import { cleanVerse } from "@/lib/bible-clean";
import { namesHim, storyIssues, linkCount } from "@/lib/loop/film/naming";
import { SONGS, songBySlug } from "@/lib/loop/songs";
import { SINGLES } from "@/lib/loop/singles";

describe("KJV cleaning", () => {
  it("keeps the translators' supplied words and drops margin notes", () => {
    const raw =
      "Blessed {is} the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful. {ungodly: or, wicked}";
    expect(cleanVerse(raw)).toBe(
      "Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.",
    );
    expect(cleanVerse("His leaf also shall not {wither: Heb. fade} wither")).toBe("His leaf also shall not wither");
  });
});

describe("He is never named", () => {
  it("catches the name and the words built on it", () => {
    for (const t of ["Jesus wept.", "the CHRIST", "a Christian", "antichrist", "Emmanuel", "the Messiah"]) {
      expect(namesHim(t)).toBe(true);
    }
  });
  it("lets the words that make Him unmistakable through", () => {
    for (const t of [
      "I am the light of the world",
      "And the Word was made flesh, and dwelt among us",
      "the LORD thy God will circumcise thine heart",
    ]) {
      expect(namesHim(t)).toBe(false);
    }
  });
});

describe("story text rules", () => {
  it("refuses an em dash, a name, and a link on a card", () => {
    const codes = storyIssues("He came — Jesus did. odubostudio.com/loop").map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["names-him", "em-dash", "links"]));
  });
  it("allows one link in a caption", () => {
    expect(linkCount("Chapter one. odubostudio.com/loop/welcome")).toBe(1);
    expect(storyIssues("Chapter one. odubostudio.com/loop/welcome", { maxLinks: 1 })).toEqual([]);
  });
  it("flags characters the poster engine cannot draw", () => {
    const issues = storyIssues("A living soul ☺", { drawn: true });
    expect(issues.map((i) => i.code)).toContain("glyph");
    expect(storyIssues("And man became a living soul.", { drawn: true })).toEqual([]);
  });
});

describe("the fourteen songs", () => {
  it("run in album order with unique, fixed slugs", () => {
    expect(SONGS.map((s) => s.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(new Set(SONGS.map((s) => s.slug)).size).toBe(14);
    expect(SONGS[0].slug).toBe("welcome");
    expect(SONGS[13].slug).toBe("ghost-world");
  });
  it("contains every single under the same slug and title", () => {
    for (const s of SINGLES) {
      expect(songBySlug(s.slug)?.title).toBe(s.title);
    }
  });
  it("marks exactly the three interludes", () => {
    expect(SONGS.filter((s) => s.interlude).map((s) => s.slug)).toEqual([
      "no-end-theory",
      "every-generation",
      "midnight-marauders",
    ]);
  });
});

describe("the KJV search", () => {
  const { searchVerses, versesByRef } = jest.requireActual("@/lib/loop/film/kjv") as typeof import("@/lib/loop/film/kjv");
  it("finds a verse by reference, in any common spelling", () => {
    expect(versesByRef("Genesis 2:7")?.[0].text).toMatch(/^And the LORD God formed man of the dust of the ground/);
    expect(versesByRef("gen 2:5-7")?.map((v) => v.verse)).toEqual([5, 6, 7]);
    expect(versesByRef("1 john 1:5")?.[0].ref).toBe("1 John 1:5");
  });
  it("finds verses by a chapter's emotion words, best match first", () => {
    const hits = searchVerses("dust ground breath living soul");
    expect(hits[0].ref).toBe("Genesis 2:7");
  });
  it("never offers a verse that names Him", () => {
    const hits = searchVerses("light world darkness", 200);
    expect(hits.length).toBeGreaterThan(20);
    for (const h of hits) expect(namesHim(h.text)).toBe(false);
    expect(versesByRef("John 1:17")).toEqual([]);
  });
});
