/**
 * @jest-environment node
 *
 * The guest list export. Pure parts only.
 */
import { csvCell, guestsCsv } from "@/lib/loop/guests";

describe("csvCell", () => {
  it("passes plain values through and blanks nulls", () => {
    expect(csvCell("LOOP-K7X2")).toBe("LOOP-K7X2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("yes");
    expect(csvCell(false)).toBe("no");
  });
  it("quotes commas, quotes and newlines the way spreadsheets expect", () => {
    expect(csvCell('Odubo, "Mani"')).toBe('"Odubo, ""Mani"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
});

describe("guestsCsv", () => {
  it("writes a header and one line per guest, CRLF-terminated", () => {
    const csv = guestsCsv([
      {
        code: "LOOP-K7X2",
        email: "a@b.co",
        orderId: "shopify:1#1",
        mintedAt: "2026-09-15T21:17:24.000Z",
        redeemed: false,
        admittedAt: null,
        consentedAt: "2026-09-15T21:16:00.000Z",
        consentSource: "pass-sheet",
        albumClaimedAt: null,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("code,email,order,bought,opened_app,admitted,marketing_consent,source,album_claimed");
    expect(lines[1]).toBe("LOOP-K7X2,a@b.co,shopify:1#1,2026-09-15T21:17:24.000Z,no,,2026-09-15T21:16:00.000Z,pass-sheet,");
    expect(lines[2]).toBe("");
  });
});
