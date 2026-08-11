import { NextRequest, NextResponse } from "next/server";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings, setPassSetting, type PassSettings } from "@/lib/loop/pass/settings";

/** Never echo the webhook signing secret to the client — presence only. */
function publicSettings(s: PassSettings) {
  const { webhookSecret, ...rest } = s;
  return { ...rest, hasWebhookSecret: Boolean(webhookSecret) };
}

/** Pass-sales configuration. Auth: middleware gates /api/loop/admin/*. */
export async function GET() {
  const [settings, capacity] = await Promise.all([getPassSettings(), getPassCapacity()]);
  return NextResponse.json({ settings: publicSettings(settings), capacity });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    checkoutUrl?: string | null;
    sku?: string | null;
    productId?: string | null;
    mode?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.checkoutUrl !== undefined && body.checkoutUrl) {
    try {
      const u = new URL(body.checkoutUrl);
      if (u.protocol !== "https:") throw new Error("not https");
    } catch {
      return NextResponse.json({ error: "Checkout link must be a full https:// URL" }, { status: 400 });
    }
  }
  if (body.mode !== undefined && body.mode && !["mock", "shopify"].includes(body.mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  if (body.checkoutUrl !== undefined) await setPassSetting("pass_checkout_url", body.checkoutUrl);
  if (body.sku !== undefined) await setPassSetting("pass_sku", body.sku);
  if (body.productId !== undefined) await setPassSetting("pass_product_id", body.productId);
  if (body.mode !== undefined) await setPassSetting("pass_mode", body.mode);

  const [settings, capacity] = await Promise.all([getPassSettings(), getPassCapacity()]);
  return NextResponse.json({ success: true, settings: publicSettings(settings), capacity });
}
