/**
 * @jest-environment node
 *
 * What the public may know about how full the room is. Pure, no database.
 */
import {
  capacityLine,
  isSoldOut,
  isUrgent,
  publicView,
  REVEAL_DEFAULTS,
  type PublicCapacity,
} from "@/lib/loop/capacity";

type Capped = Extract<PublicCapacity, { unlimited: false }>;
const room = (remaining: number, total = 250) =>
  publicView({ unlimited: false, total, remaining }) as Capped;

describe("publicView", () => {
  it("never reveals sales while the room is open", () => {
    const c = room(248);
    expect(c).toEqual({ unlimited: false, total: 250, state: "open", remaining: null });
    // the whole point: two sold out of 250 must not be inferable
    expect(JSON.stringify(c)).not.toContain("248");
  });

  it("starts counting down only once it is genuinely low", () => {
    expect(room(REVEAL_DEFAULTS.filling + 1).state).toBe("open");
    expect(room(REVEAL_DEFAULTS.filling).state).toBe("filling");
    expect(room(REVEAL_DEFAULTS.filling).remaining).toBe(REVEAL_DEFAULTS.filling);
    expect(room(REVEAL_DEFAULTS.last).state).toBe("last");
    expect(room(0).state).toBe("full");
    expect(room(-5).state).toBe("full");
  });

  it("says nothing numeric about an uncapped room", () => {
    expect(publicView({ unlimited: true, total: null, remaining: null })).toEqual({ unlimited: true });
    expect(capacityLine({ unlimited: true })).toBeNull();
  });
});

describe("capacityLine", () => {
  it("states the size of the room, not the sales", () => {
    expect(capacityLine(room(248))).toBe("250 in the room");
  });
  it("warns with a real number when it matters", () => {
    expect(capacityLine(room(12))).toBe("12 passes left");
    expect(capacityLine(room(12), { free: true })).toBe("12 spots left");
    expect(capacityLine(room(0))).toBe("Room is full");
  });
});

describe("isSoldOut / isUrgent", () => {
  it("is full only at zero, and urgent only near it", () => {
    expect(isSoldOut(room(1))).toBe(false);
    expect(isSoldOut(room(0))).toBe(true);
    expect(isUrgent(room(248))).toBe(false);
    expect(isUrgent(room(60))).toBe(false);
    expect(isUrgent(room(12))).toBe(true);
  });
});
