/**
 * @jest-environment node
 *
 * What the door accepts as a pass. Pure, no database.
 */
import { doorUrlFor, parseScannedCode } from "@/lib/loop/door";

describe("parseScannedCode", () => {
  it("reads the door URL a ticket QR encodes", () => {
    expect(parseScannedCode("https://www.odubostudio.com/loop/admin/door?c=LOOP-K7X2")).toBe("LOOP-K7X2");
  });
  it("reads a bare code, in any case, with noise around it", () => {
    expect(parseScannedCode("loop-k7x2")).toBe("LOOP-K7X2");
    expect(parseScannedCode("  your pass: LOOP-K7X2 · show at the door")).toBe("LOOP-K7X2");
  });
  it("refuses what is not a pass", () => {
    expect(parseScannedCode("https://example.com/")).toBeNull();
    expect(parseScannedCode("LOOP-K7X")).toBeNull();
    expect(parseScannedCode("")).toBeNull();
    expect(parseScannedCode(null)).toBeNull();
  });
  it("round-trips through the URL it makes", () => {
    const url = doorUrlFor("LOOP-K7X2", "https://www.odubostudio.com/");
    expect(url).toBe("https://www.odubostudio.com/loop/d?c=LOOP-K7X2");
    expect(parseScannedCode(url)).toBe("LOOP-K7X2");
  });
});
