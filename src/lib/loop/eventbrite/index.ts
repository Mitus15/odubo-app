/**
 * Eventbrite provider — behind an interface so the app never depends on
 * Eventbrite directly. `EVENTBRITE_MODE=mock` returns a manually-set capacity
 * (no API, no account needed); `EVENTBRITE_MODE=live` will hit Scott's real
 * organizer token. Flipping the env var is the ONLY change at handover.
 */

export type CapacityInfo = {
  total: number;
  sold: number;
  remaining: number;
};

/** A completed ticket purchase — the unit a unique event code is issued against. */
export type TicketOrder = {
  orderId: string;
  email: string | null;
};

export interface EventbriteProvider {
  getCapacity(): Promise<CapacityInfo>;
}

const EB_API = "https://www.eventbriteapi.com/v3";

/**
 * Eventbrite webhooks are NOT HMAC-signed (unlike Stripe): the POST body only
 * carries an `api_url` you must fetch with your private token to get real data.
 * So the two lines of defence are (1) a shared secret on the endpoint URL query
 * string — the owner registers the webhook as `…/api/eventbrite/webhook?secret=X`
 * — and (2) only ever fetching `api_url`s on the eventbriteapi.com host with the
 * private token (a forged api_url pointing elsewhere is refused below).
 *
 * Returns true when the request may be trusted. If `EVENTBRITE_WEBHOOK_SECRET`
 * is unset we skip the check (mock/dev, where the admin "simulate" tool drives
 * it); in live it's expected to be set and a mismatch is rejected.
 */
export function webhookSecretOk(req: Request): boolean {
  const expected = process.env.EVENTBRITE_WEBHOOK_SECRET;
  if (!expected) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === expected;
}

/**
 * Map an inbound order webhook to a `TicketOrder`. In `mock` mode it accepts a
 * simple `{ orderId, email }` body (driven by the admin "simulate a purchase"
 * tool). In `live` mode the webhook body only carries an `api_url` for the order
 * resource, so we validate its host and GET it with `EVENTBRITE_API_TOKEN` to
 * read the buyer's email. Returns null if the payload isn't a usable order.
 */
export async function parseOrderWebhook(rawBody: string): Promise<TicketOrder | null> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (process.env.EVENTBRITE_MODE === "live") {
    const apiUrl = body.api_url ?? body.order_url;
    const token = process.env.EVENTBRITE_API_TOKEN;
    if (!apiUrl || !token) return null;

    // Only ever dereference an eventbriteapi.com URL — never a host an attacker
    // slipped into the payload.
    let target: URL;
    try {
      target = new URL(String(apiUrl));
    } catch {
      return null;
    }
    if (target.hostname !== "www.eventbriteapi.com") return null;

    try {
      const res = await fetch(target.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`[eventbrite:live] order fetch failed ${res.status}`);
        return null;
      }
      const order = (await res.json()) as { id?: string; email?: string; status?: string };
      // Only issue a code for a completed purchase.
      if (order.status && order.status !== "placed") return null;
      if (!order.id) return null;
      return { orderId: String(order.id), email: order.email ?? null };
    } catch (err) {
      console.error("[eventbrite:live] order fetch error:", err);
      return null;
    }
  }

  if (!body.orderId) return null;
  return { orderId: String(body.orderId), email: (body.email as string) ?? null };
}

/** Manual capacity from env — drives the scarcity counter during the build/promo. */
class MockEventbriteProvider implements EventbriteProvider {
  async getCapacity(): Promise<CapacityInfo> {
    const total = Number(process.env.MOCK_PASSES_TOTAL ?? 75);
    const sold = Number(process.env.MOCK_PASSES_SOLD ?? 44);
    const remaining = Math.max(0, total - sold);
    return { total, sold, remaining };
  }
}

/**
 * Real capacity from Eventbrite. Sums `quantity_total` / `quantity_sold` across
 * the event's ticket classes (the org token can read these). Any missing cred
 * or API error falls back to the mock numbers so the scarcity counter never
 * breaks the page — dormant until `EVENTBRITE_API_TOKEN` + `EVENTBRITE_EVENT_ID`
 * are set.
 */
class LiveEventbriteProvider implements EventbriteProvider {
  async getCapacity(): Promise<CapacityInfo> {
    const token = process.env.EVENTBRITE_API_TOKEN;
    const eventId = process.env.EVENTBRITE_EVENT_ID;
    if (!token || !eventId) return new MockEventbriteProvider().getCapacity();

    try {
      const res = await fetch(`${EB_API}/events/${eventId}/ticket_classes/`, {
        headers: { Authorization: `Bearer ${token}` },
        // Numbers move as tickets sell; keep it fresh but not per-request.
        next: { revalidate: 30 },
      });
      if (!res.ok) {
        console.error(`[eventbrite:live] capacity fetch failed ${res.status}`);
        return new MockEventbriteProvider().getCapacity();
      }
      const data = (await res.json()) as {
        ticket_classes?: Array<{ quantity_total?: number; quantity_sold?: number }>;
      };
      const classes = data.ticket_classes ?? [];
      const total = classes.reduce((n, c) => n + (c.quantity_total ?? 0), 0);
      const sold = classes.reduce((n, c) => n + (c.quantity_sold ?? 0), 0);
      return { total, sold, remaining: Math.max(0, total - sold) };
    } catch (err) {
      console.error("[eventbrite:live] capacity error:", err);
      return new MockEventbriteProvider().getCapacity();
    }
  }
}

export function getEventbrite(): EventbriteProvider {
  return process.env.EVENTBRITE_MODE === "live"
    ? new LiveEventbriteProvider()
    : new MockEventbriteProvider();
}
