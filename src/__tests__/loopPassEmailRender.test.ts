/**
 * @jest-environment node
 *
 * The pass email's words. Short, true, and free of the things it used to say.
 */
import { renderPassEmail, tracksNowLine } from "@/lib/loop/email/passEmail";

const facts = {
  line: "Saturday 10 October · Scott's Inn, Kamloops · from 6:30",
  earlyCount: 3,
  recordUrl: "https://www.odubostudio.com/loop/album",
};

const one = [{ code: "LOOP-K7X2", serial: 42, link: "https://www.odubostudio.com/loop/p/pl_a", index: 1, total: 1, cid: "ticket-1" }];
const three = [1, 2, 3].map((i) => ({
  code: `LOOP-000${i}`,
  serial: 42 + i,
  link: `https://www.odubostudio.com/loop/p/pl_${i}`,
  index: i,
  total: 3,
  cid: `ticket-${i}`,
}));

describe("renderPassEmail", () => {
  it("names the product, not the edition", () => {
    expect(renderPassEmail(one, facts).subject).toBe("Your Loop Soul pass");
    expect(renderPassEmail(three, facts).subject).toBe("Your Loop Soul passes");
    for (const part of Object.values(renderPassEmail(one, facts))) expect(part).not.toMatch(/Volume/);
  });

  it("carries the number, the code, the night and the link, in both parts", () => {
    const { text, html } = renderPassEmail(one, facts);
    for (const part of [text, html]) {
      expect(part).toContain("OS-");
      expect(part).toContain("LOOP-K7X2");
      expect(part).toContain(facts.line);
      expect(part).toContain("https://www.odubostudio.com/loop/p/pl_a");
      expect(part).toContain("Three tracks are yours now");
    }
    expect(html).toContain('src="cid:ticket-1"');
    expect(html).toContain("Open your record");
  });

  it("is short and says none of the old things", () => {
    const { text } = renderPassEmail(one, facts);
    expect(text.split(/\s+/).length).toBeLessThan(70);
    for (const part of Object.values(renderPassEmail(one, facts))) {
      expect(part).not.toContain("—");
      expect(part).not.toMatch(/enter this email/i);
      expect(part).not.toMatch(/cover/i);
      expect(part).not.toMatch(/vote/i);
      expect(part).not.toMatch(/loop\/code/);
    }
  });

  it("numbers several guests and gives each their own link", () => {
    const { text, html } = renderPassEmail(three, facts);
    expect(text).toMatch(/Guest 2 of 3 · OS-\d{6} · LOOP-0002/);
    expect(text).toContain("/loop/p/pl_2");
    expect(html).toContain("Guest 3 of 3");
    expect(html.match(/Open your record/g)).toHaveLength(3);
    expect(text).toContain("one per guest");
  });

  it("falls back to the record's page when a pass has no link", () => {
    const { text } = renderPassEmail([{ ...one[0], link: null }], facts);
    expect(text).toContain("Open your record: https://www.odubostudio.com/loop/album");
  });
});

describe("tracksNowLine", () => {
  it("counts in words and never promises what is off", () => {
    expect(tracksNowLine(3)).toBe("Three tracks are yours now, the rest after the night.");
    expect(tracksNowLine(1)).toBe("One track is yours now, the rest after the night.");
    expect(tracksNowLine(0)).toBe("The record lands here after the night.");
    expect(tracksNowLine(null)).toBe("The record lands here after the night.");
  });
});
