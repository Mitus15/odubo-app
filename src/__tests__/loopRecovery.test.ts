/**
 * @jest-environment node
 *
 * The recovery rule: who holds a pass after its owner proves the inbox on a
 * new phone. Pure, so it runs without a database.
 */
import { hashOtp, newOtp, normEmail, planReclaim } from "@/lib/loop/recovery";

describe("newOtp", () => {
  it("is six digits, zero-padded", () => {
    for (let i = 0; i < 200; i++) expect(newOtp()).toMatch(/^\d{6}$/);
  });
});

describe("hashOtp", () => {
  it("is stable for the same inputs and blind to email case", async () => {
    const a = await hashOtp("Jane@Example.com", "123456");
    const b = await hashOtp("jane@example.com ", "123456");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
  it("changes with the code", async () => {
    expect(await hashOtp("j@x.com", "111111")).not.toBe(await hashOtp("j@x.com", "111112"));
  });
});

describe("planReclaim", () => {
  const me = "device-new";
  const owner = "att_owner";

  it("takes an unredeemed pass without evicting anyone", () => {
    const plan = planReclaim(me, owner, [{ code: "LOOP-AAAA", redeemedBy: null }], new Map());
    expect(plan).toEqual({ take: ["LOOP-AAAA"], evict: [] });
  });

  it("leaves a pass already on this device alone", () => {
    const plan = planReclaim(me, owner, [{ code: "LOOP-AAAA", redeemedBy: me }], new Map([[me, owner]]));
    expect(plan).toEqual({ take: [], evict: [] });
  });

  it("leaves the owner's other phone alone", () => {
    const plan = planReclaim(me, owner, [{ code: "LOOP-AAAA", redeemedBy: "device-old" }], new Map([["device-old", owner]]));
    expect(plan).toEqual({ take: [], evict: [] });
  });

  it("takes a pass back from a stranger, and from an unbound device", () => {
    const plan = planReclaim(
      me,
      owner,
      [
        { code: "LOOP-AAAA", redeemedBy: "thief" },
        { code: "LOOP-BBBB", redeemedBy: "unbound" },
        { code: "LOOP-CCCC", redeemedBy: "thief" },
      ],
      new Map([
        ["thief", "att_thief"],
        ["unbound", null],
      ]),
    );
    expect(plan.take.sort()).toEqual(["LOOP-AAAA", "LOOP-BBBB", "LOOP-CCCC"]);
    expect(plan.evict).toEqual([
      { voterId: "thief", codes: ["LOOP-AAAA", "LOOP-CCCC"] },
      { voterId: "unbound", codes: ["LOOP-BBBB"] },
    ]);
  });

  it("handles a mixed order: one on my old phone, one stolen, one fresh", () => {
    const plan = planReclaim(
      me,
      owner,
      [
        { code: "LOOP-1111", redeemedBy: "device-old" },
        { code: "LOOP-2222", redeemedBy: "thief" },
        { code: "LOOP-3333", redeemedBy: null },
      ],
      new Map([
        ["device-old", owner],
        ["thief", "att_thief"],
      ]),
    );
    expect(plan.take.sort()).toEqual(["LOOP-2222", "LOOP-3333"]);
    expect(plan.evict).toEqual([{ voterId: "thief", codes: ["LOOP-2222"] }]);
  });
});

describe("normEmail", () => {
  it("lowercases and trims", () => {
    expect(normEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
});
