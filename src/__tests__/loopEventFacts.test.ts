/**
 * @jest-environment node
 */
import { bareTime, factsLine, longDate, nightLine, programmeTimes, shareLine, shortDate, venueShort } from "@/lib/loop/eventFacts";
import { RUN_OF_SHOW } from "@/lib/loop/content";

const event = { date: "2026-10-10T18:30:00-07:00", venue: "Scott's Inn, Kamloops", theme: "80s" };

describe("eventFacts", () => {
  it("formats the night in the venue's timezone", () => {
    expect(longDate(event.date)).toBe("Saturday 10 October");
    expect(shortDate(event.date)).toBe("Sat Oct 10");
    expect(bareTime(event.date)).toBe("6:30");
    expect(venueShort(event.venue)).toBe("Scott's Inn");
  });

  it("builds the one line every surface shows", () => {
    expect(factsLine(event)).toBe("Saturday 10 October · Scott's Inn, Kamloops · from 6:30");
  });

  it("reads the album and floor times off the programme", () => {
    expect(programmeTimes(RUN_OF_SHOW)).toEqual({ album: "8", floor: "9" });
    expect(programmeTimes([])).toBeNull();
    expect(programmeTimes([{ id: "album", time: "8:30", title: "", detail: "" }])).toBeNull();
  });

  it("says the night in one sentence, and still says it without a programme", () => {
    expect(nightLine("80s", RUN_OF_SHOW)).toBe("The album live at 8. 80s floor at 9. 19+. Dress code 80s.");
    expect(nightLine("80s", [])).toBe("The album, live. Then the 80s floor. 19+. Dress code 80s.");
  });
});

describe("shareLine", () => {
  const e = { date: "2026-10-11T01:30:00.000Z", venue: "Scott's Inn, Kamloops", theme: "80s" };
  it("carries the day, the venue, the age and the price", () => {
    expect(shareLine(e, "$5")).toBe("Sat Oct 10 · Scott's Inn, Kamloops · 19+ · $5");
  });
  it("reads Free when the door is free", () => {
    expect(shareLine(e, "FREE ENTRY")).toBe("Sat Oct 10 · Scott's Inn, Kamloops · 19+ · Free");
  });
});

describe("the single's page", () => {
  const { isThisSingle, singleMeta } = jest.requireActual("@/lib/loop/singlePage") as typeof import("@/lib/loop/singlePage");
  it("only calls 1984 by its name", () => {
    expect(isThisSingle("1984")).toBe(true);
    expect(isThisSingle(" 1984 ")).toBe(true);
    expect(isThisSingle("News Peak")).toBe(false);
    expect(isThisSingle(null)).toBe(false);
  });
  it("reads as the song when pasted", () => {
    const m = singleMeta(
      { title: "1984", artistName: "Mani Odubo", albumTitle: "Loop Soul" },
      { dateLabel: "Sat Oct 10", venue: "Scott's Inn, Kamloops" },
    );
    expect(m.title).toBe("1984 · Mani Odubo");
    expect(m.description).toBe("The lead single from Loop Soul, free to hear. The album plays live Sat Oct 10 at Scott's Inn, Kamloops.");
  });
});

describe("press captions", () => {
  const { captions, daysInWords, daysUntil } = jest.requireActual("@/lib/loop/press/copy") as typeof import("@/lib/loop/press/copy");
  const facts = { doors: "6:30", album: "8", price: "$5", days: 18, site: "odubostudio.com/loop" };
  it("counts down in words, in venue days", () => {
    expect(daysUntil("2026-09-22", "2026-10-10")).toBe(18);
    expect(daysInWords(18)).toBe("Eighteen");
    expect(daysInWords(26)).toBe("Twenty six");
    expect(daysInWords(30)).toBe("Thirty");
  });
  it("puts the date, the place, the price and 19+ in every caption, and no em dash", () => {
    for (const c of captions(facts)) {
      expect(c.text).toMatch(/October 10/);
      expect(c.text).toMatch(/Scott's/);
      expect(c.text).toContain("$5");
      expect(c.text).toContain("19+");
      expect(c.text).not.toContain("—");
    }
  });
  it("says Tonight on the night", () => {
    expect(captions({ ...facts, days: 0 }).find((c) => c.id === "countdown")!.text.startsWith("Tonight.")).toBe(true);
  });
});
