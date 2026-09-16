/**
 * @jest-environment node
 *
 * Where the buyer's email is read from on a Shopify order. Pure, no database.
 */
import { isLoopPassOrder, parseShopifyOrder } from "@/lib/loop/pass";

const matcher = { sku: "LOOP-PASS-VOL1", productId: null };
const item = { line_items: [{ sku: "LOOP-PASS-VOL1", quantity: 1 }], financial_status: "paid" };

describe("parseShopifyOrder email", () => {
  it("reads the top-level email first", () => {
    expect(parseShopifyOrder(JSON.stringify({ id: 1, email: "a@x.co", ...item }), matcher)?.email).toBe("a@x.co");
  });
  it("falls back to contact_email, then customer.email", () => {
    expect(parseShopifyOrder(JSON.stringify({ id: 1, contact_email: "b@x.co", ...item }), matcher)?.email).toBe("b@x.co");
    expect(parseShopifyOrder(JSON.stringify({ id: 1, customer: { email: "c@x.co" }, ...item }), matcher)?.email).toBe("c@x.co");
  });
  it("is null when Shopify strips every one of them, and the pass still counts", () => {
    const o = parseShopifyOrder(JSON.stringify({ id: 1, email: null, contact_email: null, customer: { email: null }, ...item }), matcher);
    expect(o?.email).toBeNull();
    expect(o?.passCount).toBe(1);
  });
});

describe("isLoopPassOrder", () => {
  const matcher = { sku: "LOOP-PASS-VOL1", productId: null };
  const order = (extra: Record<string, unknown>) => JSON.stringify({ id: 1, line_items: [], ...extra });

  it("is true for a pass line item", () => {
    expect(isLoopPassOrder(order({ line_items: [{ sku: "LOOP-PASS-VOL1", quantity: 1 }] }), matcher)).toBe(true);
  });
  it("is true for the pass sheet's loop_ref, even with no pass line", () => {
    expect(isLoopPassOrder(order({ note_attributes: [{ name: "loop_ref", value: "pi_abc" }] }), matcher)).toBe(true);
  });
  it("is false for a hoodie, and for junk", () => {
    expect(isLoopPassOrder(order({ line_items: [{ sku: "HOODIE-M", quantity: 1 }] }), matcher)).toBe(false);
    expect(isLoopPassOrder("not json", matcher)).toBe(false);
  });
});
