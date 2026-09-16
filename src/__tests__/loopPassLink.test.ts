/**
 * @jest-environment node
 *
 * The claim link and the pass number, pure.
 */
import {
  formatSerial,
  hashPassLinkToken,
  isPassLinkToken,
  newPassLinkToken,
  parseUnitOrderId,
  passLinkUrl,
} from "@/lib/loop/passLink";

describe("newPassLinkToken", () => {
  it("is long, URL-safe, prefixed, and never repeats", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const t = newPassLinkToken();
      expect(isPassLinkToken(t)).toBe(true);
      expect(t).toMatch(/^pl_[A-Za-z0-9_-]{43}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(100);
  });

  it("refuses anything that is not shaped like one", () => {
    expect(isPassLinkToken("")).toBe(false);
    expect(isPassLinkToken("pl_short")).toBe(false);
    expect(isPassLinkToken("LOOP-K7X2")).toBe(false);
    expect(isPassLinkToken(`pl_${"a".repeat(43)}/`)).toBe(false);
    expect(isPassLinkToken(null)).toBe(false);
  });
});

describe("hashPassLinkToken", () => {
  it("is stable for the same token and pepper, and changes with either", async () => {
    const t = newPassLinkToken();
    const a = await hashPassLinkToken(t, "pepper");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassLinkToken(t, "pepper")).toBe(a);
    expect(await hashPassLinkToken(t, "other")).not.toBe(a);
    expect(await hashPassLinkToken(newPassLinkToken(), "pepper")).not.toBe(a);
  });
});

describe("passLinkUrl", () => {
  it("rides the configured base, never a typed domain", () => {
    expect(passLinkUrl("pl_x", "https://www.odubostudio.com")).toBe("https://www.odubostudio.com/loop/p/pl_x");
    expect(passLinkUrl("pl_x", "https://www.odubostudio.com/")).toBe("https://www.odubostudio.com/loop/p/pl_x");
    expect(passLinkUrl("pl_x", "https://www.odubostudio.com", "room")).toBe("https://www.odubostudio.com/loop/p/pl_x?to=room");
  });
});

describe("parseUnitOrderId", () => {
  it("reads the order and the unit off a pass unit id", () => {
    expect(parseUnitOrderId("shopify:7088817537237#1")).toEqual({ order: "7088817537237", unit: 1 });
    expect(parseUnitOrderId("shopify:7088817537237#3")).toEqual({ order: "7088817537237", unit: 3 });
  });
  it("is null for comps and simulated sales", () => {
    expect(parseUnitOrderId(null)).toBeNull();
    expect(parseUnitOrderId("sim:ab12cd34")).toBeNull();
    expect(parseUnitOrderId("")).toBeNull();
  });
});

describe("formatSerial", () => {
  it("pads to three digits with the ordinal sign Jost can draw", () => {
    expect(formatSerial(42)).toBe("Nº 042");
    expect(formatSerial(1)).toBe("Nº 001");
    expect(formatSerial(1234)).toBe("Nº 1234");
    // U+00BA, never U+2116.
    expect(formatSerial(7)?.charCodeAt(1)).toBe(0xba);
  });
  it("is null when there is no number", () => {
    expect(formatSerial(null)).toBeNull();
    expect(formatSerial(undefined)).toBeNull();
    expect(formatSerial(0)).toBeNull();
  });
});
