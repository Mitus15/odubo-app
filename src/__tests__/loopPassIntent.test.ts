/**
 * @jest-environment node
 *
 * Carrying the buyer's address past a Shopify plan that will not hand it over.
 */
import { checkoutUrlWithIntent, refFromNoteAttributes } from "@/lib/loop/passIntent";

describe("checkoutUrlWithIntent", () => {
  it("prefills Shopify's email field and carries our reference", () => {
    const u = new URL(checkoutUrlWithIntent("https://shop.odubostudio.com/cart/123:1", "a@b.co", "pi_x"));
    expect(u.searchParams.get("checkout[email]")).toBe("a@b.co");
    expect(u.searchParams.get("attributes[loop_ref]")).toBe("pi_x");
    expect(u.pathname).toBe("/cart/123:1");
  });
  it("keeps whatever the admin already put on the link", () => {
    const u = new URL(checkoutUrlWithIntent("https://s.co/cart/1:1?discount=LOOP", "a@b.co", "pi_x"));
    expect(u.searchParams.get("discount")).toBe("LOOP");
  });
});

describe("refFromNoteAttributes", () => {
  it("finds our reference among Shopify's attributes", () => {
    expect(refFromNoteAttributes([{ name: "other", value: "x" }, { name: "loop_ref", value: "pi_abc" }])).toBe("pi_abc");
  });
  it("is null when absent, empty or missing entirely", () => {
    expect(refFromNoteAttributes([{ name: "loop_ref", value: "  " }])).toBeNull();
    expect(refFromNoteAttributes([])).toBeNull();
    expect(refFromNoteAttributes(null)).toBeNull();
  });
});
