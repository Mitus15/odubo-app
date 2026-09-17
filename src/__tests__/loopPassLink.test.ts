/**
 * @jest-environment node
 *
 * The claim link and the pass number, pure.
 */
import {
  passNumberDigits,
  publicPassNumber,
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

describe("publicPassNumber", () => {
  it("is a six-digit reference that never reveals the sale count", () => {
    expect(publicPassNumber(1)).toBe("OS-473837");
    expect(publicPassNumber(2)).toBe("OS-847674");
    // The second sale must not look like "the second sale".
    expect(publicPassNumber(2)).not.toContain("002");
    for (const n of [1, 2, 3, 7, 42, 250]) {
      expect(passNumberDigits(n)).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it("is stable: the same pass always shows the same number", () => {
    expect(publicPassNumber(42)).toBe(publicPassNumber(42));
  });

  it("is a bijection across a whole room, so two guests never share a number", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 2000; n++) seen.add(passNumberDigits(n) as string);
    expect(seen.size).toBe(2000);
  });

  it("puts consecutive sales nowhere near each other", () => {
    for (let n = 1; n < 50; n++) {
      const a = Number(passNumberDigits(n));
      const b = Number(passNumberDigits(n + 1));
      expect(Math.abs(a - b)).toBeGreaterThan(1000);
    }
  });

  it("is null when there is no number (door comps, simulated sales)", () => {
    expect(publicPassNumber(null)).toBeNull();
    expect(publicPassNumber(undefined)).toBeNull();
    expect(publicPassNumber(0)).toBeNull();
  });
});
