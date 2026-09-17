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
